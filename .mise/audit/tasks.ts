import { parseArgs } from 'node:util'

import type { Audit }              from './audit.ts'
import { TomlFile }                from './files.ts'
import { Finding, type Spot }      from './finding.ts'
import { CONFIG }                  from './mise.ts'
import { type Command, commands } from './shell.ts'

interface Defect {
  details : string
  message : string
  task    : string
}

interface Listed {
  file   : string | null
  name   : string
  run    : (string | { tasks: string[] })[]
  source : string
}

interface Script {
  line : number
  text : string
}

const INSTALL = new Set(['i', 'install'])
const LISTING = { file: CONFIG, line: 1 }
const LOCKED  = new Set(['frozen-lockfile', 'lockfile-only'])
const OPTIONS = { cwd: { type: 'string' } } as const

/**
 * A task mise lists, holding the scripts it runs and the defects `mise tasks
 * validate` reports against it.
 */
class Task {
  readonly #defects : Defect[]
  readonly #scripts : Script[]
  readonly #spot    : Spot

  /**
   * Reads the scripts of `listed`, the whole script for a task mise runs from a
   * file, a TOML task's `file` included, and each string of its `run` for any
   * other TOML task.
   */
  static read(audit: Audit, defects: Defect[], listed: Listed): Task {
    const file = audit.relative(listed.file ?? listed.source)
    const text = audit.read(file)

    if (listed.file !== null) return new Task(defects, [{ line: 1, text }], { file, line: 1 })

    const toml = new TomlFile(file, text)
    const path = toml.at(listed.name) ? [listed.name] : ['tasks', listed.name]

    return new Task(
      defects,
      listed.run
        .filter((run) => typeof run === 'string')
        .map((run) => ({ line: toml.lineOf(run, ...path) ?? 1, text: run })),
      { file, line: toml.at(...path)?.line ?? 1 }
    )
  }

  constructor(defects: Defect[], scripts: Script[], spot: Spot) {
    this.#defects = defects
    this.#scripts = scripts
    this.#spot    = spot
  }

  get findings(): Finding[] {
    return [
      ...this.#installs,
      ...this.#defects.map((defect) => new Finding(
        `${defect.message}. ${defect.details}`,
        this.#spot,
        'Task defect'
      ))
    ]
  }

  /**
   * Rejects each `bun install` the task runs carrying neither
   * `--frozen-lockfile` nor `--lockfile-only`.
   */
  get #installs(): Finding[] {
    return this.#scripts.values()
      .flatMap(({ line, text }) => commands(text, line))
      .filter(unfrozen)
      .map(({ line, words }) => new Finding(
        `\`${words.join(' ')}\` runs without \`--frozen-lockfile\` or \`--lockfile-only\``,
        { file: this.#spot.file, line },
        'Unfrozen install'
      ))
      .toArray()
  }
}

/**
 * The tasks mise lists from the checkout, beside the defects `mise tasks
 * validate` reports against them.
 */
export class TaskList {
  readonly #errors : Finding[]
  readonly #tasks  : Task[]

  /**
   * Lists every task the checkout declares through mise, hidden ones included,
   * beside each defect `mise tasks validate` finds in them.
   *
   * A failure of either call, such as a task file mise cannot parse, becomes a
   * finding.
   */
  static read(audit: Audit): TaskList {
    let defects : Defect[]
    let listed  : Listed[]

    try {
      defects = JSON.parse(audit.mise('tasks', 'validate', '--json')).issues
      listed  = JSON.parse(audit.mise('tasks', 'ls', '--hidden', '--json', '--local'))
    } catch (error) {
      return new TaskList([new Finding(String(error), LISTING, 'Task listing')], [])
    }

    const reported = Map.groupBy(defects, (defect) => defect.task)

    return new TaskList([], listed.map((task) => Task.read(audit, reported.get(task.name) ?? [], task)))
  }

  constructor(errors: Finding[], tasks: Task[]) {
    this.#errors = errors
    this.#tasks  = tasks
  }

  get findings(): Finding[] {
    return [...this.#errors, ...this.#tasks.flatMap((task) => task.findings)]
  }
}

function unfrozen({ words: [program, ...args] }: Command): boolean {
  if (program !== 'bun') return false

  const { positionals: [verb = ''], values } = parseArgs({
    allowPositionals : true,
    args             : args,
    options          : OPTIONS,
    strict           : false
  })

  return INSTALL.has(verb) && LOCKED.isDisjointFrom(new Set(Object.keys(values)))
}
