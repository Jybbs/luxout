import { execFileSync }                                                 from 'node:child_process'
import { existsSync, globSync, readFileSync, realpathSync, statSync }   from 'node:fs'
import { createRequire, findPackageJSON }                               from 'node:module'
import { basename, dirname, join, matchesGlob, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL }                                 from 'node:url'

import type * as Experimental from 'rolldown/experimental'
import type * as Utils        from 'rolldown/utils'
import stripJsonComments      from 'strip-json-comments'
import type { Vitest }        from 'vitest/node'

/**
 * A node naming a member or key, beside whether the name is computed or, for
 * a shorthand property, also the value it reads.
 */
interface Keyed {
  computed   : boolean
  key        : Utils.ESTree.Span
  shorthand? : boolean
}

/**
 * The modules a module imports, each beside the bindings it takes from it, and
 * the paths its strings spell. Where a VitePress site's `.vitepress` directory
 * holds the module, `site` names the site's root. `lists` names the exports
 * listing its pages and `own` reports whether its own statements list them,
 * per `listings`, and `resolves` whether it imports `resolveConfig` from
 * `vitepress`.
 */
interface Scan {
  imports   : Map<string, Set<string>>
  lists     : Set<string>
  own       : boolean
  resolves  : boolean
  spellings : string[]
  site?     : string
}

/**
 * The files a VitePress site builds from beside the modules its config and
 * theme import, per `site`.
 */
export interface Site {
  pages     : Map<string, string[]>
  publicDir : string
}

/**
 * The fields of a resolved VitePress config that place the pages of a site,
 * its public directory, and the options its Markdown renders under.
 */
interface SiteConfig {
  markdown   : unknown
  pages      : string[]
  publicDir  : string
  site       : { base: string }
  srcDir     : string
  userConfig : { srcExclude?: string[] }
}

/**
 * A string a module holds, beside the offset it starts at and whether it is
 * the whole string rather than a part of a template literal holding an
 * expression.
 */
interface Spelling {
  start : number
  text  : string
  whole : boolean
}

/**
 * A token of a Markdown page as VitePress's renderer parses it, an inline
 * token holding the tokens of its text as `children`.
 */
interface Token {
  attrGet  : (name: string) => string | null
  children : Token[] | null
  type     : string
}

/**
 * The modules a suite imports and the files read to transform and install
 * them, per `traced`.
 */
interface Traced {
  modules : string[]
  reads   : string[]
}

/**
 * The fields of a tsconfig that name other tsconfig files.
 */
interface Tsconfig {
  extends?    : string | string[]
  references? : { path: string }[]
}

/**
 * The functions of VitePress's node API that resolve the config of a site and
 * create the Markdown renderer its pages build through.
 */
interface VitePress {
  createMarkdownRenderer : (
    srcDir    : string,
    options   : unknown,
    base      : string,
    logger    : undefined,
    publicDir : string
  ) => Promise<{ parse: (text: string, env: object) => Token[] }>
  resolveConfig          : (root: string, command: 'build') => Promise<SiteConfig>
}

const ALL       = '*'
const BREAKS    = /[\s"'`=;|&<>(){}]+/
const FS        = new Set(['fs', 'fs/promises', 'node:fs', 'node:fs/promises'])
const GLOB      = /[*?[{]/
const IGNORED   = ['**/dist/**', '**/node_modules/**']
const LISTS     = new Set(['glob', 'globSync', 'opendir', 'opendirSync', 'readdir', 'readdirSync'])
const MARKDOWN  = /(?:^|\*)\.md$/
const MODULES   = `${sep}node_modules${sep}`
const PAGES     = '**/*.md'
const RESOLVING = {
  conditionNames : ['node', 'import'],
  extensionAlias : { '.js': ['.ts', '.js'] },
  symlinks       : false
}
const SCRIPT = /\.[cm]?[jt]sx?$/
const SITE   = `${sep}.vitepress${sep}`
const TASK   = /^[\w-]+(?::[\w-]+)+$/

/**
 * Names the binding an import or a re-export takes, `default` for a default
 * import and `ALL` for a namespace import or an `export *`.
 */
function bound({ kind, name }: { kind: string, name: string | null }): string {
  return name ?? (kind === 'Default' ? 'default' : ALL)
}

/**
 * Lists `file` and its real path beside each file its `extends` chain names,
 * which the `tsconfigFilePaths` of `resolveTsconfig` leaves out. A file under
 * `node_modules` stands as the `bun.lock` that installs it, and so does a real
 * path under one.
 */
function chain(file: string, extender: Experimental.ResolverFactory): string[] {
  const lock = lockfile(file)

  if (lock) {
    return [lock]
  }

  const dir   = dirname(file)
  const paths = [parsed(file).extends ?? []].flat().map((base) => extended(base, dir, extender))
  const real  = realpathSync(file)

  return [file, lockfile(real) ?? real, ...paths.flatMap((path) => chain(path, extender))]
}

/**
 * Lists the name and the span of each binding `statement` declares at the top
 * of a module, exported or not.
 */
function declared(statement: Utils.ESTree.Program['body'][number]): [string, Utils.ESTree.Span][] {
  const node = statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration'
             ? statement.declaration
             : statement

  if (node?.type === 'VariableDeclaration') {
    return node.declarations.flatMap((declarator) =>
      declarator.id.type === 'Identifier' ? [[declarator.id.name, declarator]] : []
    )
  }

  return (node?.type === 'ClassDeclaration' || node?.type === 'FunctionDeclaration') && node.id
    ? [[node.id.name, node]]
    : []
}

/**
 * Resolves the `extends` entry `base` of a tsconfig in `dir` as rolldown does,
 * taking a path that opens on `.` or `/` as `named` takes it, and resolving
 * any other entry through `extender`.
 */
function extended(base: string, dir: string, extender: Experimental.ResolverFactory): string {
  if (/^[./]/.test(base)) {
    return named(resolve(dir, base))
  }

  return located(dir, base, extender)
}

/**
 * Runs Git with `args` in `cwd`, returning what it prints.
 */
function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: cwd, encoding: 'utf8' })
}

/**
 * Maps each module `module` imports with a value, and each dynamic import
 * naming a string, resolved through `resolver` from the directory of `file`,
 * to the bindings it takes from it, per `bound`, a dynamic import taking
 * `ALL`.
 */
function imports(
  file     : string,
  module   : Utils.ParseResult['module'],
  resolver : Experimental.ResolverFactory,
  text     : string
): Map<string, Set<string>> {
  const requests: [string, string[]][] = [
    ...module.staticImports
      .filter(({ entries }) => !entries.length || entries.some(({ isType }) => !isType))
      .map(({ entries, moduleRequest }): [string, string[]] => [
        moduleRequest.value,
        entries.filter(({ isType }) => !isType).map(({ importName }) => bound(importName))
      ]),
    ...module.staticExports.flatMap(({ entries }) => entries.flatMap(
      ({ importName, isType, moduleRequest }): [string, string[]][] =>
        moduleRequest && !isType ? [[moduleRequest.value, [bound(importName)]]] : []
    )),
    ...module.dynamicImports
      .filter(({ moduleRequest: { start } }) => /['"]/.test(text.charAt(start)))
      .map(({ moduleRequest: { end, start } }): [string, string[]] => [text.slice(start + 1, end - 1), [ALL]])
  ]
  const found = new Map<string, Set<string>>()

  for (const [request, names] of requests) {
    const { path } = resolver.sync(dirname(file), request)

    if (path !== undefined) {
      found.set(path, new Set(names).union(found.get(path) ?? new Set()))
    }
  }

  return found
}

/**
 * Names each export of `module` whose declaration, or a declaration of
 * `module` it names in turn, calls a function of `node:fs` in `LISTS` beside a
 * string of `texts` naming every Markdown file, as the `.md` extension alone
 * or a glob ending `*.md` does, and reports as `own` whether a statement of
 * `module` does, since a page of a site is a Markdown file under its source
 * directory.
 */
function listings(
  module  : Utils.ParseResult['module'],
  program : Utils.ESTree.Program,
  texts   : Spelling[],
  Visitor : typeof Utils.Visitor
): Pick<Scan, 'lists' | 'own'> {
  const listers = new Set(module.staticImports
    .filter(({ moduleRequest }) => FS.has(moduleRequest.value))
    .flatMap(({ entries }) => entries.filter(({ importName }) => LISTS.has(importName.name ?? '')))
    .map(({ localName }) => localName.value))

  if (!listers.size) {
    return { lists: new Set(), own: false }
  }

  const calls: number[]          = []
  const keys                     = new Set<number>()
  const marks                    = texts.filter(({ text }) => MARKDOWN.test(text)).map(({ start }) => start)
  const spans                    = new Map(program.body.flatMap(declared))
  const uses: [string, number][] = []

  const keyed = ({ computed, key, shorthand }: Keyed): void => {
    if (!computed && !shorthand) {
      keys.add(key.start)
    }
  }

  new Visitor({
    CallExpression: ({ callee, start }) => {
      if (callee.type === 'Identifier' && listers.has(callee.name)) {
        calls.push(start)
      }
    },

    Identifier: ({ name, start }) => {
      if (spans.has(name) && !keys.has(start)) {
        uses.push([name, start])
      }
    },

    MemberExpression: ({ computed, property }) => {
      keyed({ computed: computed, key: property })
    },

    MethodDefinition    : keyed,
    Property            : keyed,
    PropertyDefinition  : keyed,
    TSPropertySignature : keyed
  }).visit(program)

  const reaches = (span: Utils.ESTree.Span): boolean => {
    const reached = [span]

    for (const { end, start } of reached) {
      for (const [name, at] of uses) {
        const local = spans.get(name)

        if (local && start <= at && at < end && !reached.includes(local)) {
          reached.push(local)
        }
      }
    }

    const within = (at: number): boolean => reached.some(({ end, start }) => start <= at && at < end)

    return calls.some(within) && marks.some(within)
  }

  return {
    own   : program.body.some(reaches),
    lists : new Set(module.staticExports.flatMap((statement) => statement.entries.flatMap((entry) =>
        !entry.moduleRequest && reaches(spans.get(entry.localName.name ?? '') ?? statement)
      ? [bound(entry.exportName)]
      : []
    )))
  }
}

/**
 * Resolves `request` through `resolver` from `dir`, failing where nothing
 * resolves.
 */
function located(dir: string, request: string, resolver: Experimental.ResolverFactory): string {
  const { error, path } = resolver.sync(dir, request)

  if (path === undefined) {
    throw new Error(`${request} in ${dir}: ${error}`)
  }

  return path
}

/**
 * Names the `bun.lock` beside the outermost `node_modules` holding `path`,
 * where one holds it, so a path into a Bun isolated store names the lockfile
 * of the project that installs it.
 */
function lockfile(path: string): string | undefined {
  const owner = path.indexOf(MODULES)

  return owner >= 0 ? join(path.slice(0, owner), 'bun.lock') : undefined
}

/**
 * Lists the path a `package.json` takes in `dir` and in each directory above
 * it, up to the path `found` or, where `found` is unset, up to the filesystem
 * root.
 */
function lookups(dir: string, found?: string): string[] {
  const path = join(dir, 'package.json')

  return path === found || dir === dirname(dir) ? [path] : [path, ...lookups(dirname(dir), found)]
}

/**
 * Resolves a tsconfig path as rolldown does, to the `tsconfig.json` inside a
 * directory, to the file itself, or else to the path with `.json` added.
 */
function named(path: string): string {
  const stat = statSync(path, { throwIfNoEntry: false })

  if (stat?.isDirectory()) {
    return join(path, 'tsconfig.json')
  }

  return stat?.isFile() ? path : `${path}.json`
}

/**
 * Reads the tsconfig `file` as rolldown does, where comments, trailing commas,
 * a byte order mark, and an empty file all parse.
 */
function parsed(file: string): Tsconfig {
  const text = stripJsonComments(readFileSync(file, 'utf8'), { trailingCommas: true })

  return JSON.parse(text.trim() || '{}') as Tsconfig
}

/**
 * Lists the path a `tsconfig.json` takes in `dir` and each directory above it,
 * beside each config the transform tests there and its `extends` chain. The
 * transform tests the configs its `references` names, in order, then the
 * `tsconfig.json` itself, and stops at the first config in `applied`.
 */
function tested(applied: string[], dir: string, extender: Experimental.ResolverFactory): string[] {
  const path    = join(dir, 'tsconfig.json')
  const configs = statSync(path, { throwIfNoEntry: false })?.isFile()
    ? [...(parsed(path).references ?? []).map((reference) => named(resolve(dir, reference.path))), path]
    : []
  const claimed = configs.findIndex((config) => applied.includes(config))
  const tests   = claimed >= 0 ? configs.slice(0, claimed + 1) : configs
  const reads   = [path, ...tests.flatMap((config) => chain(config, extender))]

  return claimed >= 0 || dir === dirname(dir)
    ? reads
    : [...reads, ...tested(applied, dirname(dir), extender)]
}

/**
 * Reports whether the path `spelling` ends `file` or names a directory
 * holding it. A glob `spelling` counts where it matches the end of `file` from
 * any directory down.
 */
function names(file: string, spelling: string): boolean {
  if (GLOB.test(spelling)) {
    const parts = file.split('/')

    return parts.some((_, start) => matchesGlob(parts.slice(start).join('/'), spelling))
  }

  return spelling.includes('/')
    ? file.endsWith(`/${spelling}`) || file.includes(`/${spelling}/`)
    : basename(file) === spelling
}

/**
 * Reports whether `changed` holds a page of the VitePress site at `site`,
 * reading its `srcDir` and `srcExclude` through the `resolveConfig` of the
 * `vitepress` that `resolver` finds there. A page is a file under `srcDir`
 * that `PAGES`, the glob VitePress lists pages through, matches and no glob of
 * `srcExclude` or of `IGNORED`, the folders VitePress always leaves out, does,
 * so a page the branch deletes counts too.
 */
async function pageChanged(
  changed  : string[],
  resolver : Experimental.ResolverFactory,
  site     : string
): Promise<boolean> {
  const { srcDir, userConfig } = (await resolved(resolver, site)).config
  const excluded               = [...IGNORED, ...userConfig.srcExclude ?? []]

  return changed.some((file) => {
    const page = relative(srcDir, file)

    return matchesGlob(page, PAGES) && !excluded.some((glob) => matchesGlob(page, glob))
  })
}

/**
 * Maps each program Git tracks under `top` to the paths its text spells, glob
 * tokens aside, where a program is a file Git records as executable or a `.sh`
 * file.
 */
function programs(top: string): Map<string, string[]> {
  const files = git(top, 'ls-files', '--stage', '-z')
    .split('\0')
    .flatMap((entry) => {
      const [stage = '', file = ''] = entry.split('\t')

      return stage.startsWith('100755') || file.endsWith('.sh') ? [join(top, file)] : []
    })

  return new Map(files.filter((file) => existsSync(file)).map((file) => [
    file,
    readFileSync(file, 'utf8')
      .split(BREAKS)
      .flatMap(spelled)
      .filter((spelling) => !GLOB.test(spelling))
  ]))
}

/**
 * Lists each test file `include` matches under `root` that reads one of
 * `changed`. A test reads a file where its own source, or a module it imports
 * outside `node_modules`, holds a string naming the file or a program that
 * names it in turn, per `rooted`, or reads the pages of a VitePress site the
 * file is one of. A module under the site's `.vitepress` reads them where it
 * imports `resolveConfig` from `vitepress`, a test there reads them where its
 * own statements list them, per `listings`, and any module reads them where it
 * imports an export `listings` names, by name or through a namespace or
 * dynamic import. VitePress takes only `.md` files as pages, so a run changing
 * none resolves no site.
 *
 * Args:
 *   changed : The absolute path of each file the branch changes.
 *   include : The suite's test file globs, relative to `root`.
 *   root    : The suite's root directory.
 *   top     : The root of the Git checkout holding `root`.
 */
async function readers(changed: string[], include: string[], root: string, top: string): Promise<string[]> {
  const require = vite(root)

  const { ResolverFactory }    = require('rolldown/experimental') as typeof Experimental
  const { Visitor, parseSync } = require('rolldown/utils') as typeof Utils

  const sites    = new Map<string, Promise<boolean>>()
  const resolver = new ResolverFactory(RESOLVING)
  const scans    = new Map<string, Scan>()
  const targets  = new Set(changed)
  const tokens   = programs(top)

  for (const target of targets) {
    tokens.forEach((spellings, program) => {
      if (spellings.some((spelling) => names(target, spelling))) {
        targets.add(program)
      }
    })
  }

  const scan = (file: string): Scan => {
    const cached = scans.get(file)

    if (cached) {
      return cached
    }

    const text                = readFileSync(file, 'utf8')
    const { module, program } = parseSync(file, text)
    const texts               = strings(program, Visitor)
    const root                = file.lastIndexOf(SITE)
    const paths               = imports(file, module, resolver, text)
    const resolves            = module.staticImports.some(({ entries, moduleRequest }) =>
      moduleRequest.value === 'vitepress'
      && entries.some(({ importName }) => importName.name === 'resolveConfig')
    )
    const found               = {
      ...listings(module, program, texts, Visitor),
      imports   : new Map(paths.entries().filter(([path]) => !lockfile(path) && SCRIPT.test(path))),
      resolves  : resolves,
      site      : root >= 0 ? file.slice(0, root) : undefined,
      spellings : rooted(texts)
    }

    scans.set(file, found)

    return found
  }

  const markdown = changed.some((file) => file.endsWith('.md'))
  const changes  = (dir: string): Promise<boolean> => {
    const found = sites.get(dir) ?? pageChanged(changed, resolver, dir)

    sites.set(dir, found)

    return found
  }

  const listed = (path: string, names: Set<string>): string | undefined => {
    const { lists, site } = scan(path)

    return names.values().some((name) => name === ALL ? lists.size > 0 : lists.has(name)) ? site : undefined
  }

  const reads = async (test: string): Promise<boolean> => {
    const modules = new Set([test])

    for (const module of modules) {
      const { imports, own, resolves, site, spellings } = scan(module)

      if (spellings.some((spelling) => targets.values().some((target) => names(target, spelling)))) {
        return true
      }

      const listing = imports.entries().map(([path, names]) => listed(path, names))
      const sources = markdown ? [resolves || (own && module === test) ? site : undefined, ...listing] : []

      for (const source of sources) {
        if (source && await changes(source)) {
          return true
        }
      }

      imports.keys().forEach((path) => modules.add(path))
    }

    return false
  }

  const tests = globSync(include, { cwd: root }).map((file) => join(root, file))
  const kept  = await Promise.all(tests.map(reads))

  return tests.filter((_, index) => kept[index])
}

/**
 * Loads the `vitepress` that `resolver` finds at the VitePress site `site` and
 * resolves the config of the site through it.
 */
async function resolved(
  resolver : Experimental.ResolverFactory,
  site     : string
): Promise<{ config: SiteConfig, vitepress: VitePress }> {
  const vitepress = await import(pathToFileURL(located(site, 'vitepress', resolver)).href) as VitePress

  return { config: await vitepress.resolveConfig(site, 'build'), vitepress: vitepress }
}

/**
 * Lists the paths `texts` spell, per `spelled`, leaving out each holding white
 * space. A glob naming no directory outside its wildcards counts only joined
 * under each whole string of `texts` holding no wildcard, white space, or `$`,
 * read as the `cwd` of the call running it, since a part of a template literal
 * is no `cwd` on its own.
 */
function rooted(texts: Spelling[]): string[] {
  const spellings = texts.flatMap(({ text }) => spelled(text)).filter((spelling) => !/\s/.test(spelling))
  const dirs      = texts
    .filter(({ text, whole }) => whole && !GLOB.test(text) && !/[\s$]/.test(text))
    .map(({ text }) => text)
    .map((text) => text.split('/').filter((part) => !/^\.{0,2}$/.test(part)).join('/'))
    .filter(Boolean)

  return spellings.flatMap((spelling) =>
    !GLOB.test(spelling) || spelling.split('/').slice(0, -1).some((part) => !GLOB.test(part))
      ? [spelling]
      : dirs.map((dir) => `${dir}/${spelling}`)
  )
}

/**
 * Lists the one path `text` spells, `text` being a string a module holds or a
 * token a program holds:
 *
 * - A task name `group:name` spells its task file under `.mise/tasks/`
 * - Each leading `.`, `..`, or segment holding a `$` drops off, and a later
 *   segment holding a `$` leaves no path
 * - A path of one segment counts only where a `.` follows its first
 *   character, so `src` and `.mise` spell nothing
 */
function spelled(text: string): string[] {
  const parts    = TASK.test(text) ? ['.mise', 'tasks', ...text.split(':')] : text.split('/')
  const start    = parts.findIndex((part) => !/^\.{0,2}$|\$/.test(part))
  const segments = start < 0 ? [] : parts.slice(start).filter(Boolean)
  const [first]  = segments

  if (!first || segments.some((part) => part.includes('$'))) {
    return []
  }

  return segments.length > 1 || /^.+\./.test(first) ? [segments.join('/')] : []
}

/**
 * Lists the strings `program` holds, each beside the offset of the node
 * holding it:
 *
 * - Each string literal but the source of an import or export
 * - Each part of a template literal, and a template literal holding an
 *   expression read whole as a glob, `*` standing for each expression, where
 *   the glob holds a `/` and a segment that, once its extension drops off,
 *   holds a character other than `*` or `.`
 * - The run of string arguments ending each `join` or `resolve` call, joined
 *   by `/`
 */
function strings(program: Utils.ESTree.Program, Visitor: typeof Utils.Visitor): Spelling[] {
  const found: Spelling[] = []
  const sources           = new Set<number>()
  const source            = ({ source }: { source: Utils.ESTree.Expression | null }): void => {
    if (source) {
      sources.add(source.start)
    }
  }

  new Visitor({
    ExportAllDeclaration   : source,
    ExportNamedDeclaration : source,
    ImportDeclaration      : source,
    ImportExpression       : source,

    CallExpression: ({ arguments: args, callee, start }) => {
      const name   = callee.type === 'MemberExpression' && !callee.computed ? callee.property : callee
      const values = args.map((arg) =>
        arg.type === 'Literal' && typeof arg.value === 'string' ? arg.value : undefined
      )
      const parts  = values.slice(values.lastIndexOf(undefined) + 1)

      if (name.type === 'Identifier' && ['join', 'resolve'].includes(name.name) && parts.length) {
        found.push({ start: start, text: parts.join('/'), whole: true })
      }
    },

    Literal: ({ start, value }) => {
      if (typeof value === 'string' && !sources.has(start)) {
        found.push({ start: start, text: value, whole: true })
      }
    },

    TemplateLiteral: ({ expressions, quasis, start }) => {
      const glob  = quasis.map(({ value: { cooked } }) => cooked ?? '').join('*')
      const named = glob.split('/').some((part) => /[^*.]/.test(part.replace(/\.[^*.]*$/, '')))

      if (expressions.length && glob.includes('/') && named) {
        found.push({ start: start, text: glob, whole: true })
      }

      for (const { start, value: { cooked } } of quasis) {
        if (cooked) {
          found.push({ start: start, text: cooked, whole: !expressions.length })
        }
      }
    }
  }).visit(program)

  return found
}

/**
 * Creates the provider of the files a `--changed` run starts from. It lists
 * each file Git reports changed, through the commands Vitest's own provider
 * runs, beside each test file `include` matches that reads one of them, per
 * `readers`.
 */
export function changedFiles(include: string[]): Vitest['vcs'] {
  return {
    findChangedFiles: async ({ changedSince, root }) => {
      const top   = resolve(root, git(root, 'rev-parse', '--show-cdup').trim())
      const since = typeof changedSince === 'string'
                  ? [['diff', '--name-only', `${changedSince}...HEAD`]]
                  : []
      const changed = [
        ...since,
        ['diff', '--cached', '--name-only'],
        ['ls-files', '--other', '--modified', '--exclude-standard']
      ]
        .flatMap((args) => git(top, ...args).split('\n'))
        .filter(Boolean)
        .map((file) => join(top, file))

      return [...changed, ...await readers(changed, include, root, top)]
    }
  }
}

/**
 * Lists the `bun.lock` of each package `bun_packages` in `.mise/lib/lock.sh`
 * names, relative to `root`.
 */
export function lockfiles(root: string): string[] {
  return execFileSync('bash', ['-c', 'source .mise/lib/lock.sh && bun_packages'], {
    cwd      : root,
    encoding : 'utf8'
  }).split('\n').slice(0, -1).map((dir) => join(dir, 'bun.lock'))
}

/**
 * Maps each script of `modules` to the files of `files` whose path a string of
 * the script spells, per `rooted` and `names`, leaving out a module that is no
 * script or spells none. A spelling counts only where it names a directory, so
 * a file name alone, such as `index.ts`, names no file.
 *
 * Args:
 *   files   : The absolute path of each file a string can name.
 *   modules : The absolute path of each module to read.
 *   root    : The directory whose Vite parses the modules, per `vite`.
 */
export function mentions(files: string[], modules: string[], root: string): Map<string, string[]> {
  const { Visitor, parseSync } = vite(root)('rolldown/utils') as typeof Utils

  return new Map(modules.filter((module) => SCRIPT.test(module)).flatMap((module) => {
    const { program } = parseSync(module, readFileSync(module, 'utf8'))
    const spellings   = rooted(strings(program, Visitor)).filter((spelling) => spelling.includes('/'))
    const found       = files.filter((file) => spellings.some((spelling) => names(file, spelling)))

    return found.length ? [[module, found]] : []
  }))
}

/**
 * Reads the VitePress site at `dir` through the `vitepress` it installs.
 *
 * Returns:
 *   The absolute path of each page `resolveConfig` lists, beside the files
 *   its Markdown images embed by a relative path, resolved from the page's
 *   directory as VitePress's image rule resolves them, and the public
 *   directory the config names, empty where the config turns it off.
 */
export async function site(dir: string): Promise<Site> {
  const { ResolverFactory }   = vite(dir)('rolldown/experimental') as typeof Experimental
  const { config, vitepress } = await resolved(new ResolverFactory(RESOLVING), dir)
  const { publicDir, srcDir } = config
  const renderer              = await vitepress.createMarkdownRenderer(
    srcDir,
    config.markdown,
    config.site.base,
    undefined,
    publicDir
  )

  const embeds = (path: string, page: string): string[] => renderer
    .parse(readFileSync(path, 'utf8'), { path: path, relativePath: page })
    .flatMap(({ children }) => children ?? [])
    .filter(({ type }) => type === 'image')
    .flatMap((token) => token.attrGet('src') ?? [])
    .filter((source) => !source.startsWith('/'))
    .map((source) => new URL(source, pathToFileURL(path)))
    .filter(({ protocol }) => protocol === 'file:')
    .map((url) => fileURLToPath(url))

  return {
    pages     : new Map(config.pages.map((page) => [join(srcDir, page), embeds(join(srcDir, page), page)])),
    publicDir : publicDir
  }
}

/**
 * Follows each import from the test files `include` matches under `root`
 * through every module outside `node_modules`.
 *
 * Args:
 *   include : The suite's test file globs, relative to `root`.
 *   root    : The suite's root directory.
 *
 * Returns:
 *   The absolute path of each test file and each module outside
 *   `node_modules` it imports at any depth, beside the files read to
 *   transform and install them: each tsconfig Vite's transform tests for a
 *   module and the files its `extends` chain names, the path a
 *   `tsconfig.json` takes in each directory the transform walks, the path a
 *   `package.json` takes in each directory from the module's own up to the
 *   nearest one, and the `bun.lock` beside each `node_modules` an import
 *   resolves through.
 */
export function traced(root: string, include: string[]): Traced {
  const require = vite(root)

  const { ResolverFactory, resolveTsconfig } = require('rolldown/experimental') as typeof Experimental
  const { TsconfigCache, parseSync }         = require('rolldown/utils') as typeof Utils

  const cache    = new TsconfigCache()
  const data     = new Set<string>()
  const modules  = new Set(globSync(include, { cwd: root }).map((file) => join(root, file)))
  const reads    = new Set<string>()
  const resolver = new ResolverFactory(RESOLVING)
  const extender = resolver.cloneWithOptions({
    conditionNames : ['node', 'import'],
    extensions     : ['.json'],
    mainFiles      : ['tsconfig'],
    symlinks       : false
  })

  for (const file of modules) {
    const text       = readFileSync(file, 'utf8')
    const { module } = parseSync(file, text)
    const tsconfigs  = resolveTsconfig(file, cache)?.tsconfigFilePaths ?? []
    const paths      = imports(file, module, resolver, text).keys()
    const settings   = [
      ...tested(tsconfigs, dirname(file), extender),
      ...lookups(dirname(file), findPackageJSON(pathToFileURL(file)))
    ]

    settings.forEach((path) => reads.add(path))

    for (const path of paths) {
      const lock = lockfile(path)

      if (lock) {
        reads.add(lock)
      } else if (SCRIPT.test(path)) {
        modules.add(path)
      } else {
        data.add(path)
      }
    }
  }

  return { modules: [...modules, ...data], reads: [...reads] }
}

/**
 * Lists the files a suite reads beside the modules it imports, per `traced`,
 * and this file.
 */
export function triggers(root: string, include: string[]): string[] {
  return [import.meta.filename, ...traced(root, include).reads]
}

/**
 * Creates a `require` resolving from the Vite that Vitest loads under `root`,
 * whose `rolldown` reads each tsconfig its transform applies.
 */
export function vite(root: string): NodeJS.Require {
  const base = createRequire(join(root, 'package.json'))

  return ['vitest', 'vite'].reduce((from, id) => createRequire(from.resolve(id)), base)
}
