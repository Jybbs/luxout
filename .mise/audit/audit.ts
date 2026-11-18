import { type SpawnSyncReturns, spawnSync }   from 'node:child_process'
import { existsSync, globSync, readFileSync } from 'node:fs'
import { join, relative, resolve }            from 'node:path'

import { traced }          from '../../tests/common/triggers.ts'
import { Actions }         from './actions.ts'
import { DeployPaths }     from './deploy.ts'
import type { Finding }    from './finding.ts'
import { LabelRegistry }   from './labels.ts'
import { LineBudget }      from './lines.ts'
import { MiseConfig }      from './mise.ts'
import { PackageManifest } from './package.ts'
import { ReleaseNotes }    from './release.ts'
import { Rulesets }        from './rulesets.ts'
import { TaskList }        from './tasks.ts'
import { IssueTemplates }  from './templates.ts'
import { VetManifests }    from './vet.ts'
import { Workflows }       from './workflows.ts'

type Output     = Pick<SpawnSyncReturns<string>, 'error' | 'stderr' | 'stdout'>
export type Run = (command: string, args: string[], options: { cwd: string, encoding: 'utf8' }) => Output

export class Audit {
  readonly #root  : string
  readonly #run   : Run
  readonly #write : (line: string) => void

  constructor(root: string, run: Run = spawnSync, write: (line: string) => void = console.log) {
    this.#root  = root
    this.#run   = run
    this.#write = write
  }

  get #findings(): Finding[] {
    const actions   = Actions.read(this)
    const labels    = LabelRegistry.read(this)
    const manifest  = PackageManifest.read(this)
    const tasks     = TaskList.read(this)
    const workflows = Workflows.read(this)

    return [
      ...[manifest, ...PackageManifest.installed(this)].flatMap(({ findings }) => findings),
      ...MiseConfig.read(this).findings(manifest),
      ...VetManifests.read(this).findings(manifest),
      ...tasks.findings(manifest),
      ...actions.findings,
      ...workflows.findings(actions, tasks),
      ...DeployPaths.read(this).findings(tasks),
      ...Rulesets.read(this).findings(workflows),
      ...labels.findings,
      ...ReleaseNotes.read(this).findings(labels),
      ...IssueTemplates.read(this).findings(labels),
      ...LineBudget.read(this).findings
    ]
  }

  exists(file: string): boolean {
    return existsSync(join(this.#root, file))
  }

  /**
   * Lists the module `file` in the directory `dir` and each module it imports
   * outside `node_modules`, beside the files read to transform and install
   * them, per `traced`, relative to the checkout and leaving out each path
   * outside it.
   */
  imports(dir: string, file: string): string[] {
    const { modules, reads } = traced(join(this.#root, dir), [file])

    return [...modules, ...reads].map((path) => this.relative(path)).filter((path) => !path.startsWith('..'))
  }

  /**
   * Runs mise with `args` in the checkout and returns what it prints whatever
   * its exit status, which `mise tasks validate` sets nonzero on a defect.
   */
  mise(...args: string[]): string {
    const { stderr, stdout } = this.#spawn('mise', args)

    if (stdout === '') throw new Error(stderr.trim())

    return stdout
  }

  /**
   * Lists each package directory `bun_packages` in `.mise/lib/lock.sh` names,
   * relative to the checkout.
   */
  packages(): string[] {
    const { stderr, stdout } = this.#spawn('bash', ['-c', 'source .mise/lib/lock.sh && bun_packages'])

    if (stderr !== '') throw new Error(stderr.trim())

    return stdout.split('\n').filter((dir) => dir !== '')
  }

  read(file: string): string {
    return readFileSync(join(this.#root, file), 'utf8')
  }

  readAll(...patterns: string[]): Record<string, string> {
    const files = globSync(patterns, { cwd: this.#root }).toSorted()

    return Object.fromEntries(files.map((file) => [file, this.read(file)]))
  }

  relative(path: string): string {
    return relative(this.#root, resolve(this.#root, path))
  }

  /**
   * Reads each file git tracks in the checkout under one of `patterns`, keyed
   * by its path, leaving out a tracked file the working tree no longer holds.
   */
  tracked(...patterns: string[]): Record<string, string> {
    const { stderr, stdout } = this.#spawn('git', ['ls-files', '-z', '--', ...patterns])

    if (stderr !== '') throw new Error(stderr.trim())

    const files = stdout.split('\0').filter((file) => file !== '' && this.exists(file))

    return Object.fromEntries(files.map((file) => [file, this.read(file)]))
  }

  report(): number {
    const findings = this.#findings

    for (const finding of findings) this.#write(finding.annotation)

    return Number(findings.length > 0)
  }

  #spawn(command: string, args: string[]): Output {
    const output = this.#run(command, args, { cwd: this.#root, encoding: 'utf8' })

    if (output.error) throw output.error

    return output
  }
}
