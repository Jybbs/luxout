import { parseArgs } from 'node:util'

import type { Audit }             from './audit.ts'
import { TomlFile }               from './files.ts'
import { Finding, type Spot }     from './finding.ts'
import { CONFIG }                 from './mise.ts'
import { type Invocation, scan } from './shell.ts'

interface Defect {
  message  : string
  task     : string
  details? : string
}

interface Listed {
  file   : string | null
  name   : string
  run    : (string | { tasks: string[] })[]
  source : string
}

interface Script extends Spot {
  text: string
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
   * Reads the scripts of `listed`, the whole file for a file task, the script a
   * TOML task's `file` names, and each string of a TOML task's `run`.
   *
   * A defect `mise tasks validate` reports lands on the table declaring a TOML
   * task, and a `file` naming no script on disk yields no script to read.
   */
  static read(audit: Audit, defects: Defect[], listed: Listed): Task {
    const source = audit.relative(listed.source)
    const text   = audit.read(source)

    if (listed.file === listed.source) {
      return new Task(defects, [{ file: source, line: 1, text }], { file: source, line: 1 })
    }

    const toml = new TomlFile(source, text)
    const path = toml.at(listed.name) ? [listed.name] : ['tasks', listed.name]
    const spot = { file: source, line: toml.at(...path)?.line ?? 1 }

    if (listed.file !== null) {
      const file = audit.relative(listed.file)

      return new Task(defects, audit.exists(file) ? [{ file, line: 1, text: audit.read(file) }] : [], spot)
    }

    return new Task(
      defects,
      listed.run
        .filter((run) => typeof run === 'string')
        .map((run) => ({ file: source, line: toml.lineOf(run, ...path, 'run') ?? 1, text: run })),
      spot
    )
  }

  constructor(defects: Defect[], scripts: Script[], spot: Spot) {
    this.#defects = defects
    this.#scripts = scripts
    this.#spot    = spot
  }

  get findings(): Finding[] {
    return [
      ...this.#shell,
      ...this.#defects.map(({ details, message }) => new Finding(
        [message, details].filter(Boolean).join('. '),
        this.#spot,
        'Task defect'
      ))
    ]
  }

  /**
   * Reports each error `unbash` meets in a script the task runs, and rejects
   * each `bun install` it runs carrying neither `--frozen-lockfile` nor
   * `--lockfile-only`.
   */
  get #shell(): Finding[] {
    return this.#scripts.flatMap(({ file, line, text }) => {
      const { errors, invocations } = scan(text, line)

      return [
        ...errors.map((error) => new Finding(error.message, { file, line: error.line }, 'Shell syntax')),
        ...invocations.filter(unfrozen).map((install) => new Finding(
          `\`${install.words.join(' ')}\` runs without \`--frozen-lockfile\` or \`--lockfile-only\``,
          { file, line: install.line },
          'Unfrozen install'
        ))
      ]
    })
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

function unfrozen({ words: [program, ...args] }: Invocation): boolean {
  if (program !== 'bun') return false

  const { positionals: [verb = ''], values } = parseArgs({
    allowPositionals : true,
    args             : args,
    options          : OPTIONS,
    strict           : false
  })

  return INSTALL.has(verb) && LOCKED.isDisjointFrom(new Set(Object.keys(values)))
}
