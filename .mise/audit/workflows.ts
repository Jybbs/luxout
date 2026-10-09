import type { Actions }                   from './actions.ts'
import type { Audit }                     from './audit.ts'
import { type Entry, type Key, YamlFile } from './files.ts'
import { Finding, type Spot }             from './finding.ts'
import { Step, pinned }                   from './steps.ts'
import type { TaskList }                  from './tasks.ts'

/**
 * One row of a job's matrix, naming the task the row runs and the tools the
 * composite action installs for it.
 */
interface Row {
  task  : Entry
  tools : Entry
}

const CANCEL    = "github.event_name=='pull_request'"
const CONTEXTS  = new Set(['github.workflow', 'github.ref'])
const GATE      = '🪁 Brief'
const IMAGE     = /^[a-z]+-\d[\w.-]*$/
const WORKFLOWS = ['.github/workflows/*.yml', '.github/workflows/*.yaml']

/**
 * One job of a workflow, read from the workflow's file under the key naming
 * it.
 */
class Job {
  readonly id    : string
  readonly spot  : Spot
  readonly #file : YamlFile

  constructor(file: YamlFile, key: Entry) {
    this.id    = String(key.value)
    this.spot  = key
    this.#file = file
  }

  get condition(): Entry | undefined {
    return this.#at('if')
  }

  /**
   * Reports a job running steps of its own with no `timeout-minutes`.
   */
  get findings(): Finding[] {
    return this.timeout || this.uses ? [] : [new Finding(
      `Job \`${this.id}\` sets no \`timeout-minutes\`, `
    + 'so a hung step holds its runner for the 360 minutes GitHub allows',
      this.spot,
      'Job timeout'
    )]
  }

  get image(): Entry | undefined {
    return this.#at('runs-on')
  }

  get name(): unknown {
    return this.#at('name')?.value
  }

  get needs(): Entry | undefined {
    return this.#at('needs')
  }

  /**
   * Finds the action the job and each of its steps names through `uses`.
   */
  get pins(): Entry[] {
    return [this, ...this.steps].flatMap(({ uses }) => uses ?? [])
  }

  /**
   * Finds each row of the job's matrix that names a `task`, beside the tools
   * the row names, or an empty list on the task's line where it names none.
   */
  get rows(): Row[] {
    const matrix  = ['strategy', 'matrix', 'include']
    const include = this.#at(...matrix)?.value

    return Array.isArray(include) ? include.flatMap((_, index) => {
      const task  = this.#at(...matrix, index, 'task')
      const tools = this.#at(...matrix, index, 'tools')

      return task ? [{ task, tools: tools ?? { ...task, value: '' } }] : []
    }) : []
  }

  get steps(): Step[] {
    return Step.list(this.#file, 'jobs', this.id, 'steps')
  }

  get timeout(): Entry | undefined {
    return this.#at('timeout-minutes')
  }

  get uses(): Entry | undefined {
    return this.#at('uses')
  }

  #at(...path: Key[]): Entry | undefined {
    return this.#file.at('jobs', this.id, ...path)
  }
}

/**
 * One workflow under `.github/workflows/`.
 */
class Workflow {
  readonly jobs  : Job[]
  readonly #file : YamlFile

  constructor(file: string, text: string) {
    this.#file = new YamlFile(file, text)
    this.jobs  = this.#file.keys('jobs').map((key) => new Job(this.#file, key))
  }

  /**
   * Reports each error the workflow fails to parse on, a `schedule` trigger, a
   * concurrency group that cancels more than a superseded pull-request run, a
   * job running steps of its own with no `timeout-minutes`, a gate the workflow
   * does not end on, and a job other than the gate writing the step summary.
   */
  get findings(): Finding[] {
    return [
      ...this.#file.errors,
      ...this.#schedule,
      ...this.#concurrency,
      ...this.jobs.flatMap((job) => job.findings),
      ...this.#gate
    ]
  }

  /**
   * Holds the workflow's concurrency group to one keyed by the workflow and
   * the ref, which cancels a run in progress only for a pull request.
   */
  get #concurrency(): Finding[] {
    const concurrency = this.#file.at('concurrency')
    const cancel      = this.#file.at('concurrency', 'cancel-in-progress')
    const group       = typeof concurrency?.value === 'string'
                      ? concurrency
                      : this.#file.at('concurrency', 'group')

    if (!group) {
      return [new Finding(
        'The workflow sets no `concurrency` group',
        concurrency ?? this.#start,
        'Concurrency'
      )]
    }

    const words   = new Set(String(group.value).match(/[\w.]+/g))
    const missing = [...CONTEXTS.difference(words)]
    const cancels = cancel && !['false', CANCEL].includes(expression(cancel.value))

    return [
      ...missing.length === 0 ? [] : [new Finding(
        `The \`concurrency\` group reads no \`${missing.join('` or `')}\`, `
      + 'so it groups runs that do not supersede one another',
        group,
        'Concurrency'
      )],
      ...cancels ? [new Finding(
        `\`cancel-in-progress\` is \`${String(cancel.value)}\`, `
      + 'which cancels more than a superseded pull-request run',
        cancel,
        'Concurrency'
      )] : []
    ]
  }

  /**
   * Holds the workflow to ending on the `🪁 Brief` gate, which runs under
   * `if: always()`, waits on every other job, and is the one job writing the
   * step summary.
   */
  get #gate(): Finding[] {
    const gate = this.jobs.find((job) => job.name === GATE)

    if (gate === undefined) {
      return [new Finding(
        `The workflow ends on no \`${GATE}\` gate`,
        this.#file.at('jobs') ?? this.#start,
        'Brief gate'
      )]
    }

    const others  = this.jobs.filter((job) => job !== gate)
    const waited  = new Set([gate.needs?.value].flat())
    const missing = [...new Set(others.map((job) => job.id)).difference(waited)]
    const always  = expression(gate.condition?.value) === 'always()'

    return [
      ...always ? [] : [new Finding(
        `The \`${GATE}\` gate runs without \`if: always()\`, so a failed job skips it and its check passes`,
        gate.condition ?? gate.spot,
        'Brief gate'
      )],
      ...missing.length === 0 ? [] : [new Finding(
        `The \`${GATE}\` gate waits on no \`${missing.join('`, `')}\``,
        gate.needs ?? gate.spot,
        'Brief gate'
      )],
      ...others.flatMap((job) => job.steps).flatMap((step) => step.findings)
    ]
  }

  /**
   * Rejects a `schedule` trigger, which runs the workflow on a timer rather
   * than on a development event.
   */
  get #schedule(): Finding[] {
    const on       = this.#file.at('on')
    const schedule = this.#file.keys('on').find(({ value }) => value === 'schedule')
                  ?? ([on?.value].flat().includes('schedule') ? on : undefined)

    return schedule ? [new Finding(
      '`schedule` runs the workflow on a timer rather than on a development event',
      schedule,
      'Schedule trigger'
    )] : []
  }

  get #start(): Spot {
    return { file: this.#file.file, line: 1 }
  }
}

/**
 * The workflows under `.github/workflows/`, holding the checks that read
 * several of them at once, or one beside the composite actions and the tasks
 * it runs.
 */
export class Workflows {
  readonly #jobs      : Job[]
  readonly #workflows : Workflow[]

  static read(audit: Audit): Workflows {
    return new Workflows(audit.readAll(...WORKFLOWS))
  }

  /**
   * Reads each workflow from its text in `files`, keyed by its path relative to
   * the checkout.
   */
  constructor(files: Record<string, string>) {
    this.#workflows = Object.entries(files).map(([file, text]) => new Workflow(file, text))
    this.#jobs      = this.#workflows.flatMap((workflow) => workflow.jobs)
  }

  /**
   * Holds every job to one versioned runner image, such as `ubuntu-26.04`,
   * rather than a `-latest` alias GitHub moves on its own.
   */
  get #images(): Finding[] {
    const images = this.#jobs.flatMap((job) => job.image ?? [])
    const first  = images.find((image) => IMAGE.test(String(image.value)))

    return images.flatMap((image) => {
      const value = String(image.value)

      if (!IMAGE.test(value)) {
        return [new Finding(`\`${value}\` names no versioned runner image`, image, 'Runner image')]
      }

      return first && value !== first.value ? [new Finding(
        `\`${value}\` differs from \`${String(first.value)}\`, the image ${first.file}:${first.line} names`,
        image,
        'Runner image'
      )] : []
    })
  }

  /**
   * Reports every finding each workflow raises on its own, beside a runner
   * image that is not one versioned image across every job, an action pinned
   * to two commits or followed by a comment, an input a composite action does
   * not declare, and a row whose task `repo:verify` leaves out or whose tools
   * name a release other than its task's.
   */
  findings(actions: Actions, tasks: TaskList): Finding[] {
    return [
      ...this.#workflows.flatMap((workflow) => workflow.findings),
      ...this.#images,
      ...pinned([...this.#jobs.flatMap((job) => job.pins), ...actions.pins]),
      ...this.#inputs(actions),
      ...tasks.listed ? this.#rows(tasks) : []
    ]
  }

  /**
   * Rejects each input a step passes a composite action under `.github/` that
   * its manifest does not declare, since GitHub only warns before running the
   * action on its defaults.
   */
  #inputs(actions: Actions): Finding[] {
    return this.#jobs.flatMap((job) => job.steps).flatMap((step) => {
      const uses     = String(step.uses?.value)
      const declared = actions.inputs(uses)

      if (!declared) return []

      return step.inputs
        .filter((input) => !declared.has(String(input.value)))
        .map((input) => new Finding(
          `\`${uses}\` declares no input \`${String(input.value)}\``,
          input,
          'Action input'
        ))
    })
  }

  /**
   * Holds each row's task to running in `repo:verify` unless it declares a
   * Node release of its own, and the tools a row installs to name each release
   * its task declares, as `<tool>@<release>`.
   */
  #rows(tasks: TaskList): Finding[] {
    const verified = tasks.verified

    return this.#jobs.flatMap((job) => job.rows).flatMap(({ task, tools }) => {
      const name     = String(task.value)
      const own      = tasks.tools(name) ?? {}
      const declared = new Set(Object.entries(own).map(([tool, release]) => `${tool}@${release}`))
      const named    = new Set(String(tools.value).split(/\s+/).filter((word) => word.includes('@')))
      const included = own.node !== undefined || verified.has(name)

      return [
        ...included ? [] : [new Finding(
          `Row \`${name}\` runs a task \`repo:verify\` leaves out, so \`mise ci\` passes where the row fails`,
          task,
          'Check row'
        )],
        ...declared.symmetricDifference(named)
          .values()
          .map((release) => new Finding(
            declared.has(release)
              ? `Row \`${name}\` installs no \`${release}\`, the release its task runs on`
              : `Row \`${name}\` installs \`${release}\`, a release its task does not declare`,
            tools,
            'Check row'
          ))
      ]
    })
  }
}

/**
 * Strips the white space and the `${{ }}` delimiters from a workflow
 * expression, such as an `if` or a `cancel-in-progress` value.
 */
function expression(value: unknown): string {
  return String(value).replaceAll(/\s|\$\{\{|\}\}/g, '')
}
