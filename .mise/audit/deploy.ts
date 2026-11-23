import { basename, relative } from 'node:path'

import picomatch from 'picomatch'

import type { Audit }    from './audit.ts'
import { YamlFile }      from './files.ts'
import { Finding }       from './finding.ts'
import { CONFIG }        from './mise.ts'
import { scan }          from './shell.ts'
import type { TaskList } from './tasks.ts'

const BUILD       = 'site:linkcheck'
const PROVISION   = ['.github/actions/provision/action.yml', CONFIG, '.mise/mise.lock']
const SITE        = 'site'
const SITE_CONFIG = 'site/.vitepress/config.ts'
const ENTRIES     = { [SITE_CONFIG]: 'config', 'site/.vitepress/theme/index.ts': 'theme' }
const WORKFLOW    = '.github/workflows/deploy.yml'
const WRAPPERS    = '.mise/bin/*'

/**
 * Holds the `on.push.paths` globs of the workflow deploying the site to every
 * file the site build reads.
 */
export class DeployPaths {
  readonly #file     : YamlFile
  readonly #imports  : Record<string, string[]>
  readonly #inputs   : [string, string][]
  readonly #wrappers : string[]

  /**
   * Reads the workflow, the wrappers, and the files read to build the site
   * config and the theme, leaving out either entry where the checkout does not
   * hold it. Where the checkout holds the site config, it also reads the files
   * the build reads without importing them, per `inputs`.
   */
  static async read(audit: Audit): Promise<DeployPaths> {
    const entries = Object.keys(ENTRIES).filter((entry) => audit.exists(entry))
    const imports = Object.fromEntries(entries.map((entry) => [
      entry,
      audit.imports(SITE, relative(SITE, entry))
    ]))

    return new DeployPaths(
      new YamlFile(WORKFLOW, audit.exists(WORKFLOW) ? audit.read(WORKFLOW) : ''),
      imports,
      Object.keys(audit.readAll(WRAPPERS)),
      entries.includes(SITE_CONFIG) ? await inputs(audit, Object.values(imports).flat()) : []
    )
  }

  constructor(
    file     : YamlFile,
    imports  : Record<string, string[]>,
    wrappers : string[],
    inputs   : [string, string][] = []
  ) {
    this.#file     = file
    this.#imports  = imports
    this.#inputs   = inputs
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
      ...this.#inputs,
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
      ...PROVISION.map((file) => [file, 'the press job installs its tools through it'] as const),
      [WORKFLOW, 'it sets the jobs that build and publish the site']
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

/**
 * Lists the files the site build reads without importing them, each beside
 * the reason it reads them:
 *
 * - Each page VitePress builds and each file a page embeds by a relative path
 * - Each file Git tracks under the public directory, which VitePress copies
 *   into the bundle as it is
 * - Each file Git tracks under the site whose path a string naming a
 *   directory, or a relative path resolved from the module's own directory,
 *   spells in a module under the site that the config or the theme imports,
 *   since a module reading a file from disk spells the path it reads
 *
 * A file the list holds twice keeps its later reason, so a page a module also
 * spells reads as a page.
 */
async function inputs(audit: Audit, imports: string[]): Promise<[string, string][]> {
  const { pages, publicDir } = await audit.site(SITE)
  const modules              = imports.filter((file) => file.startsWith(`${SITE}/`))
  const shipped              = publicDir ? audit.files(publicDir) : []
  const spelled              = audit.mentions(SITE, modules, audit.files(SITE))

  return [
    ...[...spelled].flatMap(([module, files]) => files.map((file): [string, string] => [
      file,
      `\`${module}\`, a module the site build imports, spells its path`
    ])),
    ...shipped.map((file): [string, string] => [
      file,
      'VitePress copies it from the public directory into the bundle'
    ]),
    ...[...pages].flatMap(([page, embeds]): [string, string][] => [
      [page, 'VitePress builds it as a page'],
      ...embeds.map((file): [string, string] => [file, `the page \`${page}\` embeds it`])
    ])
  ]
}
