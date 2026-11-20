import { basename, relative } from 'node:path'

import picomatch from 'picomatch'

import type { Audit }    from './audit.ts'
import { YamlFile }      from './files.ts'
import { Finding }       from './finding.ts'
import { CONFIG }        from './mise.ts'
import { scan }          from './shell.ts'
import type { TaskList } from './tasks.ts'

const BUILD     = 'site:linkcheck'
const ENTRIES   = { 'site/.vitepress/config.ts': 'config', 'site/.vitepress/theme/index.ts': 'theme' }
const PROVISION = ['.github/actions/provision/action.yml', CONFIG, '.mise/mise.lock']
const SITE      = 'site'
const WORKFLOW  = '.github/workflows/deploy.yml'
const WRAPPERS  = '.mise/bin/*'

/**
 * Holds the `on.push.paths` globs of the workflow deploying the site to every
 * file the site build reads.
 */
export class DeployPaths {
  readonly #file     : YamlFile
  readonly #imports  : Record<string, string[]>
  readonly #wrappers : string[]

  /**
   * Reads the workflow, the wrappers, and the files read to build the site
   * config and the theme, leaving out either entry where the checkout does not
   * hold it.
   */
  static read(audit: Audit): DeployPaths {
    const entries = Object.keys(ENTRIES).filter((entry) => audit.exists(entry))

    return new DeployPaths(
      new YamlFile(WORKFLOW, audit.exists(WORKFLOW) ? audit.read(WORKFLOW) : ''),
      Object.fromEntries(entries.map((entry) => [entry, audit.imports(SITE, relative(SITE, entry))])),
      Object.keys(audit.readAll(WRAPPERS))
    )
  }

  constructor(file: YamlFile, imports: Record<string, string[]>, wrappers: string[]) {
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
      ...Object.entries(ENTRIES).flatMap(([entry, role]) => (this.#imports[entry] ?? []).map((file) => [
        file,
        file === entry
          ? `VitePress loads it as the site ${role}`
          : `building \`${entry}\` and its imports reads it`
      ] as const)),
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
