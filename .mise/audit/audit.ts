import { type SpawnSyncReturns, spawnSync }   from 'node:child_process'
import { existsSync, globSync, readFileSync } from 'node:fs'
import { join, relative, resolve }            from 'node:path'

import { Actions }         from './actions.ts'
import type { Finding }    from './finding.ts'
import { LabelRegistry }   from './labels.ts'
import { MiseConfig }      from './mise.ts'
import { PackageManifest } from './package.ts'
import { ReleaseNotes }    from './release.ts'
import { TaskList }        from './tasks.ts'
import { IssueTemplates }  from './templates.ts'
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
    const actions  = Actions.read(this)
    const labels   = LabelRegistry.read(this)
    const manifest = PackageManifest.read(this)
    const tasks    = TaskList.read(this)

    return [
      ...manifest.findings,
      ...PackageManifest.site(this)?.findings ?? [],
      ...MiseConfig.read(this).findings(manifest),
      ...tasks.findings(manifest),
      ...actions.findings,
      ...Workflows.read(this).findings(actions, tasks),
      ...labels.findings,
      ...ReleaseNotes.read(this).findings(labels),
      ...IssueTemplates.read(this).findings(labels)
    ]
  }

  exists(file: string): boolean {
    return existsSync(join(this.#root, file))
  }

  /**
   * Runs mise with `args` in the checkout and returns what it prints whatever
   * its exit status, which `mise tasks validate` sets nonzero on a defect.
   */
  mise(...args: string[]): string {
    const { error, stderr, stdout } = this.#run('mise', args, { cwd: this.#root, encoding: 'utf8' })

    if (error) throw error
    if (stdout === '') throw new Error(stderr.trim())

    return stdout
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

  report(): number {
    const findings = this.#findings

    for (const finding of findings) this.#write(finding.annotation)

    return Number(findings.length > 0)
  }
}
