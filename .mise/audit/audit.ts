import { type SpawnSyncReturns, spawnSync }   from 'node:child_process'
import { existsSync, globSync, readFileSync } from 'node:fs'
import { join, relative, resolve }            from 'node:path'

import { Actions }         from './actions.ts'
import type { Finding }    from './finding.ts'
import { MiseConfig }      from './mise.ts'
import { PackageManifest } from './package.ts'
import { TaskList }        from './tasks.ts'
import { Workflows }       from './workflows.ts'

type Output     = Pick<SpawnSyncReturns<string>, 'error' | 'stderr' | 'stdout'>
export type Run = (command: string, args: string[], options: { cwd: string, encoding: 'utf8' }) => Output

/**
 * The audit of one checkout, which reads its files, runs mise in it to list and
 * validate its tasks, and prints every finding the checks report.
 */
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
    const manifest = PackageManifest.read(this)
    const tasks    = TaskList.read(this)

    return [
      ...manifest.findings,
      ...PackageManifest.site(this)?.findings ?? [],
      ...MiseConfig.read(this).findings(manifest),
      ...tasks.findings(manifest),
      ...actions.findings,
      ...Workflows.read(this).findings(actions, tasks)
    ]
  }

  exists(file: string): boolean {
    return existsSync(join(this.#root, file))
  }

  /**
   * Runs mise with `args` in the checkout and returns what it prints whatever
   * its exit status.
   *
   * `mise tasks validate` exits nonzero on a defect beside the report it
   * prints. Where mise prints nothing, the call throws the error that starting
   * mise raised, or an `Error` carrying what mise printed to standard error.
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

  /**
   * Reads every file under the checkout matching one of `patterns`, keyed by
   * its path relative to the checkout in sorted order.
   */
  readAll(...patterns: string[]): Record<string, string> {
    const files = globSync(patterns, { cwd: this.#root }).toSorted()

    return Object.fromEntries(files.map((file) => [file, this.read(file)]))
  }

  relative(path: string): string {
    return relative(this.#root, resolve(this.#root, path))
  }

  /**
   * Prints each finding as an error annotation and returns the exit status,
   * which is nonzero where any check reported one.
   */
  report(): number {
    const findings = this.#findings

    for (const finding of findings) this.#write(finding.annotation)

    return Number(findings.length > 0)
  }
}
