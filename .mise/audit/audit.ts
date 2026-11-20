import { type SpawnSyncReturns, spawnSync }   from 'node:child_process'
import { existsSync, globSync, readFileSync } from 'node:fs'
import { join, relative, resolve }            from 'node:path'

import { mentions, site, type Site, traced } from '../../tests/common/triggers.ts'
import { Actions }                           from './actions.ts'
import { DeployPaths }                       from './deploy.ts'
import type { Finding }                      from './finding.ts'
import { LabelRegistry }                     from './labels.ts'
import { LineBudget }                        from './lines.ts'
import { MiseConfig }                        from './mise.ts'
import { PackageManifest }                   from './package.ts'
import { ReleaseNotes }                      from './release.ts'
import { Rulesets }                          from './rulesets.ts'
import { TaskList }                          from './tasks.ts'
import { IssueTemplates }                    from './templates.ts'
import { VetManifests }                      from './vet.ts'
import { Workflows }                         from './workflows.ts'

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

  exists(file: string): boolean {
    return existsSync(join(this.#root, file))
  }

  /**
   * Lists each file git tracks in the checkout under one of `patterns`,
   * leaving out a tracked file the working tree no longer holds.
   */
  files(...patterns: string[]): string[] {
    const { stderr, stdout } = this.#spawn('git', ['ls-files', '-z', '--', ...patterns])

    if (stderr !== '') throw new Error(stderr.trim())

    return stdout.split('\0').filter((file) => file !== '' && this.exists(file))
  }

  /**
   * Lists the module `file` in the directory `dir` and each module it imports
   * outside `node_modules`, beside the files read to transform and install
   * them, per `traced`, relative to the checkout and leaving out each path
   * outside it.
   */
  imports(dir: string, file: string): string[] {
    const { modules, reads } = traced(join(this.#root, dir), [file])

    return this.#relative([...modules, ...reads]).filter((path) => !path.startsWith('..'))
  }

  /**
   * Maps each of `modules` to the files of `files` whose path a string of the
   * module spells, per `mentions`, parsed through the Vite the directory `dir`
   * installs, every path relative to the checkout.
   */
  mentions(dir: string, modules: string[], files: string[]): Map<string, string[]> {
    const absolute = (paths: string[]): string[] => paths.map((path) => join(this.#root, path))
    const found    = mentions(absolute(files), absolute(modules), join(this.#root, dir))

    return new Map(found.entries().map(([module, named]): [string, string[]] => [
      this.relative(module),
      this.#relative(named)
    ]))
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
   * Reads the VitePress site in `dir`, per `site`, every path relative to the
   * checkout.
   */
  async site(dir: string): Promise<Site> {
    const { pages, publicDir } = await site(join(this.#root, dir))
    const embedded             = pages.entries().map(([page, embeds]): [string, string[]] => [
      this.relative(page),
      this.#relative(embeds)
    ])

    return { pages: new Map(embedded), publicDir: publicDir && this.relative(publicDir) }
  }

  /**
   * Reads each file git tracks in the checkout under one of `patterns`, keyed
   * by its path, per `files`.
   */
  tracked(...patterns: string[]): Record<string, string> {
    return Object.fromEntries(this.files(...patterns).map((file) => [file, this.read(file)]))
  }

  async report(): Promise<number> {
    const findings = await this.#findings()

    for (const finding of findings) this.#write(finding.annotation)

    return Number(findings.length > 0)
  }

  async #findings(): Promise<Finding[]> {
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
      ...(await DeployPaths.read(this)).findings(tasks),
      ...Rulesets.read(this).findings(workflows),
      ...labels.findings,
      ...ReleaseNotes.read(this).findings(labels),
      ...IssueTemplates.read(this).findings(labels),
      ...LineBudget.read(this).findings
    ]
  }

  #relative(paths: string[]): string[] {
    return paths.map((path) => this.relative(path))
  }

  #spawn(command: string, args: string[]): Output {
    const output = this.#run(command, args, { cwd: this.#root, encoding: 'utf8' })

    if (output.error) throw output.error

    return output
  }
}
