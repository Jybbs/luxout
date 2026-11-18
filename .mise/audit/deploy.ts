import { basename, join } from 'node:path'

import picomatch from 'picomatch'

import type { Audit }    from './audit.ts'
import { YamlFile }      from './files.ts'
import { Finding }       from './finding.ts'
import { CONFIG }        from './mise.ts'
import { scan }          from './shell.ts'
import type { TaskList } from './tasks.ts'

const BUILD     = 'site:linkcheck'
const ENTRY     = '.vitepress/config.ts'
const PROVISION = ['.github/actions/provision/action.yml', CONFIG, '.mise/mise.lock']
const SITE      = 'site'
const WORKFLOW  = '.github/workflows/deploy.yml'
const WRAPPERS  = '.mise/bin/*'
const entry     = join(SITE, ENTRY)

/**
 * Holds the `on.push.paths` globs of the workflow deploying the site to every
 * file the site build reads.
 */
export class DeployPaths {
  readonly #file     : YamlFile
  readonly #imports  : string[]
  readonly #wrappers : string[]

  static read(audit: Audit): DeployPaths {
    return new DeployPaths(
      new YamlFile(WORKFLOW, audit.exists(WORKFLOW) ? audit.read(WORKFLOW) : ''),
      audit.exists(entry) ? audit.imports(SITE, ENTRY) : [],
      Object.keys(audit.readAll(WRAPPERS))
    )
  }

  constructor(file: YamlFile, imports: string[], wrappers: string[]) {
    this.#file     = file
    this.#imports  = imports
    this.#wrappers = wrappers
  }

  /**
   * Reports each file the site build reads that no glob matches. The globs
   * read as GitHub's filter reads them for `*`, `**`, and a `!` pattern, which
   * excludes a path an earlier glob matched until a later glob matches it
   * again, and a segment opening on a `.` matches like any other. A `?`, a
   * `+`, and a `**` inside a segment take picomatch's meaning, whereas
   * GitHub's `?` and `+` act on the character before them.
   */
  findings(tasks: TaskList): Finding[] {
    const paths = this.#file.at('on', 'push', 'paths')

    if (!paths) return []

    const scripts  = tasks.chain(BUILD)
    const calls    = scripts.flatMap(({ text }) => scan(text).invocations)
    const programs = new Set(calls.map(({ words }) => words[0]))
    const globs    = [paths.value].flat().map(String).map((glob) => ({
      excludes : glob.startsWith('!'),
      matches  : picomatch(glob.replace(/^!/, ''), { dot: true })
    }))
    const reads = new Map([
      ...this.#imports.map((file) => [file, `\`${entry}\` imports it or reads it`] as const),
      ...scripts.map(({ file }) => [file, `\`${BUILD}\` runs it`] as const),
      ...this.#wrappers
        .filter((file) => programs.has(basename(file)))
        .map((file) => [file, `a task the \`${BUILD}\` chain runs calls it`] as const),
      ...PROVISION.map((file) => [file, 'the press job installs its tools through it'] as const)
    ])

    const included = (file: string): boolean =>
      globs.reduce((kept, { excludes, matches }) => matches(file) ? !excludes : kept, false)

    return [...reads]
      .filter(([file]) => !included(file))
      .map(([file, reason]) => new Finding(
        `\`${file}\` matches no \`on.push.paths\` glob, though ${reason}, `
      + 'so a push changing it leaves the site unpublished',
        paths,
        'Deploy path'
      ))
  }
}
