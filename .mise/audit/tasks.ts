import { parseArgs } from 'node:util'

import type { Audit }            from './audit.ts'
import { TomlFile }              from './files.ts'
import { Finding, type Spot }    from './finding.ts'
import { CONFIG }                from './mise.ts'
import type { PackageManifest }  from './package.ts'
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
  tools  : Record<string, string>
}

interface Script extends Spot {
  text: string
}

const INSTALL = new Set(['i', 'install'])
const LISTING = { file: CONFIG, line: 1 }
const LOCKED  = new Set(['frozen-lockfile', 'lockfile-only'])
const OPTIONS = { cwd: { type: 'string' } } as const
const VERIFY  = 'repo:verify'

class Task {
  readonly scripts  : Script[]
  readonly #defects : Defect[]
  readonly #listed  : Listed
  readonly #release : Spot
  readonly #spot    : Spot

  static read(audit: Audit, defects: Defect[], listed: Listed): Task {
    const source = audit.relative(listed.source)
    const text   = audit.read(source)

    if (listed.file === listed.source) {
      return new Task(defects, listed, [{ file: source, line: 1, text }], { file: source, line: 1 })
    }

    const toml    = new TomlFile(source, text)
    const path    = toml.at(listed.name) ? [listed.name] : ['tasks', listed.name]
    const spot    = { file: source, line: toml.at(...path)?.line ?? 1 }
    const release = { file: source, line: toml.at(...path, 'tools')?.line ?? spot.line }

    if (listed.file !== null) {
      const file    = audit.relative(listed.file)
      const scripts = audit.exists(file) ? [{ file, line: 1, text: audit.read(file) }] : []

      return new Task(defects, listed, scripts, spot, release)
    }

    return new Task(
      defects,
      listed,
      listed.run
        .filter((run) => typeof run === 'string')
        .map((run) => ({ file: source, line: toml.lineOf(run, ...path, 'run') ?? 1, text: run })),
      spot,
      release
    )
  }

  constructor(defects: Defect[], listed: Listed, scripts: Script[], spot: Spot, release: Spot = spot) {
    this.scripts  = scripts
    this.#defects = defects
    this.#listed  = listed
    this.#release = release
    this.#spot    = spot
  }

  get name(): string {
    return this.#listed.name
  }

  get subtasks(): string[] {
    return this.#listed.run.flatMap((run) => typeof run === 'string' ? [] : run.tasks)
  }

  get tools(): Record<string, string> {
    return this.#listed.tools
  }

  findings(manifest: PackageManifest): Finding[] {
    return [
      ...this.#defects.map(({ details, message }) => new Finding(
        [message, details].filter(Boolean).join('. '),
        this.#spot,
        'Task defect'
      )),
      ...this.#floor(manifest)
    ]
  }

  #floor(manifest: PackageManifest): Finding[] {
    const release = this.tools.node

    if (release === undefined) return []

    const floor = manifest.floor(release)

    if (release === floor) return []

    const line    = release.split('.')[0]
    const message = floor === undefined
                  ? `\`engines\` admits no Node ${line} line for \`${this.name}\` to run on`
                  : `\`${this.name}\` runs on Node ${release}, whereas \`engines\` sets ${floor} `
                  + `as the floor of the ${line} line`

    return [new Finding(message, this.#release, 'Node floor')]
  }
}

export class TaskList {
  readonly #errors : Finding[]
  readonly #tasks  : Map<string, Task>

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
    this.#tasks  = new Map(tasks.map((task) => [task.name, task]))
  }

  get listed(): boolean {
    return this.#errors.length === 0
  }

  get verified(): Set<string> {
    return new Set(this.#tasks.get(VERIFY)?.subtasks)
  }

  get #shell(): Finding[] {
    const scripts = new Map(this.#tasks.values()
      .flatMap((task) => task.scripts)
      .map((script) => [`${script.file}:${script.line}:${script.text}`, script]))

    return [...scripts.values()].flatMap(({ file, line, text }) => {
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

  findings(manifest: PackageManifest): Finding[] {
    return [
      ...this.#errors,
      ...this.#shell,
      ...this.#tasks.values().flatMap((task) => task.findings(manifest))
    ]
  }

  tools(name: string): Record<string, string> | undefined {
    return this.#tasks.get(name)?.tools
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
