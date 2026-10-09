import { type SpawnSyncReturns, spawnSync }   from 'node:child_process'
import { existsSync, globSync, readFileSync } from 'node:fs'
import { join, relative, resolve }            from 'node:path'

import type { Finding }    from './finding.ts'
import { LabelRegistry }   from './labels.ts'
import { MiseConfig }      from './mise.ts'
import { PackageManifest } from './package.ts'
import { ReleaseNotes }    from './release.ts'
import { TaskList }        from './tasks.ts'
import { IssueTemplates }  from './templates.ts'

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
    const labels   = LabelRegistry.read(this)
    const manifest = PackageManifest.read(this)

    return [
      ...manifest.findings,
      ...MiseConfig.read(this).findings(manifest),
      ...TaskList.read(this).findings,
      ...labels.findings,
      ...ReleaseNotes.read(this).findings(labels),
      ...IssueTemplates.read(this).findings(labels)
    ]
  }

  exists(file: string): boolean {
    return existsSync(join(this.#root, file))
  }

  /**
   * Finds every path in the checkout `pattern` matches, relative to the
   * checkout and sorted.
   */
  glob(pattern: string): string[] {
    return globSync(pattern, { cwd: this.#root }).toSorted()
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
