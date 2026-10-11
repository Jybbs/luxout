import type { Actions }                   from './actions.ts'
import type { Audit }                     from './audit.ts'
import { type Entry, type Key, YamlFile } from './files.ts'
import { Finding, type Spot }             from './finding.ts'
import { Step, pinned }                   from './steps.ts'
import type { TaskList }                  from './tasks.ts'

interface Row {
  task  : Entry
  tools : Entry
}

const CANCEL    = "github.event_name=='pull_request'"
const CONTEXTS  = new Set(['github.workflow', 'github.ref'])
const GATE      = '✨ Reading'
const IMAGE     = /^[a-z]+-\d[\w.-]*$/
const WORKFLOWS = '.github/workflows/*.{yaml,yml}'

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

  get pins(): Entry[] {
    return [this, ...this.steps].flatMap(({ uses }) => uses ?? [])
  }

  get rows(): Row[] {
    const matrix = ['strategy', 'matrix', 'include']

    return this.#file.items('jobs', this.id, ...matrix).flatMap((_, index) => {
      const task  = this.#at(...matrix, index, 'task')
      const tools = this.#at(...matrix, index, 'tools')

      return task ? [{ task, tools: tools ?? { ...task, value: '' } }] : []
    })
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

class Workflow {
  readonly jobs  : Job[]
  readonly #file : YamlFile

  constructor(file: string, text: string) {
    this.#file = new YamlFile(file, text)
    this.jobs  = this.#file.keys('jobs').map((key) => new Job(this.#file, key))
  }

  get findings(): Finding[] {
    return [
      ...this.#file.errors,
      ...this.#schedule,
      ...this.#concurrency,
      ...this.jobs.flatMap((job) => job.findings),
      ...this.#gate
    ]
  }

  get #concurrency(): Finding[] {
    const concurrency = this.#file.at('concurrency')
    const cancel      = this.#file.at('concurrency', 'cancel-in-progress')
    const pull        = this.#trigger('pull_request')
    const group       = typeof concurrency?.value === 'string'
                      ? concurrency
                      : this.#file.at('concurrency', 'group')

    if (!group) {
      return pull ? [new Finding(
        'The workflow runs on `pull_request` and sets no `concurrency` group, '
      + 'so a superseded pull-request run keeps running',
        concurrency ?? pull,
        'Concurrency'
      )] : []
    }

    const words   = new Set(String(group.value).match(/[\w.]+/g))
    const missing = [...CONTEXTS.difference(words)]
    const value   = cancel ? expression(cancel.value) : 'false'
    const cancels = cancel && !['false', CANCEL].includes(value)

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
      )] : [],
      ...pull && value === 'false' ? [new Finding(
        '`cancel-in-progress` is false or unset, so a superseded pull-request run keeps running',
        cancel ?? group,
        'Concurrency'
      )] : []
    ]
  }

  get #gate(): Finding[] {
    const gate = this.jobs.find((job) => job.name === GATE)

    if (gate === undefined) {
      return [new Finding(
        `The workflow ends on no \`${GATE}\` gate`,
        this.#file.at('jobs') ?? this.#start,
        'Reading gate'
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
        'Reading gate'
      )],
      ...missing.length === 0 ? [] : [new Finding(
        `The \`${GATE}\` gate waits on no \`${missing.join('`, `')}\``,
        gate.needs ?? gate.spot,
        'Reading gate'
      )],
      ...others.flatMap((job) => job.steps).flatMap((step) => step.findings)
    ]
  }

  get #schedule(): Finding[] {
    const schedule = this.#trigger('schedule')

    return schedule ? [new Finding(
      '`schedule` runs the workflow on a timer rather than on a development event',
      schedule,
      'Schedule trigger'
    )] : []
  }

  get #start(): Spot {
    return { file: this.#file.file, line: 1 }
  }

  #trigger(event: string): Entry | undefined {
    const on = this.#file.at('on')

    return this.#file.keys('on').find(({ value }) => value === event)
        ?? ([on?.value].flat().includes(event) ? on : undefined)
  }
}

export class Workflows {
  readonly #jobs      : Job[]
  readonly #workflows : Workflow[]

  static read(audit: Audit): Workflows {
    return new Workflows(audit.readAll(WORKFLOWS))
  }

  constructor(files: Record<string, string>) {
    this.#workflows = Object.entries(files).map(([file, text]) => new Workflow(file, text))
    this.#jobs      = this.#workflows.flatMap((workflow) => workflow.jobs)
  }

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

  findings(actions: Actions, tasks: TaskList): Finding[] {
    return [
      ...this.#workflows.flatMap((workflow) => workflow.findings),
      ...this.#images,
      ...pinned([...this.#jobs.flatMap((job) => job.pins), ...actions.pins]),
      ...this.#inputs(actions),
      ...tasks.listed ? this.#rows(tasks) : []
    ]
  }

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

function expression(value: unknown): string {
  return String(value).replaceAll(/\s|\$\{\{|\}\}/g, '')
}
