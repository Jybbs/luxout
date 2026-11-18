import { execFileSync }                                               from 'node:child_process'
import { existsSync, globSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { createRequire, findPackageJSON }                             from 'node:module'
import { basename, dirname, join, matchesGlob, resolve, sep }         from 'node:path'
import { pathToFileURL }                                              from 'node:url'

import type * as Experimental from 'rolldown/experimental'
import type * as Utils        from 'rolldown/utils'
import stripJsonComments      from 'strip-json-comments'
import type { Vitest }        from 'vitest/node'

/**
 * The modules a module imports, beside the paths its strings spell and the
 * root of the VitePress site whose pages it reads, per `site`.
 */
interface Scan {
  imports   : string[]
  spellings : string[]
  site?     : string
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
 * The function of VitePress's node API that resolves the pages of a site.
 */
interface VitePress {
  resolveConfig: (root: string, command: 'build') => Promise<{ pages: string[], srcDir: string }>
}

const BREAKS    = /[\s"'`=;|&<>(){}]+/
const GLOB      = /[*?[{]/
const MODULES   = `${sep}node_modules${sep}`
const RESOLVING = {
  conditionNames : ['node', 'import'],
  extensionAlias : { '.js': ['.ts', '.js'] },
  symlinks       : false
}
const SCRIPT = /\.[cm]?[jt]sx?$/
const SITE   = `${sep}.vitepress${sep}`
const TASK   = /^[\w-]+(?::[\w-]+)+$/

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
 * Resolves each import in `module` that carries a value, and each dynamic
 * import naming a string, through `resolver` from the directory of `file`.
 */
function imports(
  file     : string,
  module   : Utils.ParseResult['module'],
  resolver : Experimental.ResolverFactory,
  text     : string
): string[] {
  const requests = new Set([
    ...module.staticImports
      .filter(({ entries }) => !entries.length || entries.some(({ isType }) => !isType))
      .map(({ moduleRequest }) => moduleRequest.value),
    ...module.staticExports.flatMap(({ entries }) => entries.flatMap(({ isType, moduleRequest }) =>
      moduleRequest && !isType ? [moduleRequest.value] : []
    )),
    ...module.dynamicImports
      .filter(({ moduleRequest: { start } }) => /['"]/.test(text.charAt(start)))
      .map(({ moduleRequest: { end, start } }) => text.slice(start + 1, end - 1))
  ])

  return [...requests]
    .map((request) => resolver.sync(dirname(file), request).path)
    .filter((path) => path !== undefined)
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
 * Lists the path of each page VitePress resolves for the site at `site`,
 * through the `resolveConfig` of the `vitepress` that `resolver` finds there.
 */
async function pages(resolver: Experimental.ResolverFactory, site: string): Promise<string[]> {
  const path              = located(site, 'vitepress', resolver)
  const { resolveConfig } = await import(pathToFileURL(path).href) as VitePress
  const config            = await resolveConfig(site, 'build')

  return config.pages.map((page) => join(config.srcDir, page))
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
 * file is one of, per `site`. VitePress takes only `.md` files as pages, so a
 * run changing none resolves no site.
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

  const paged    = new Map<string, Promise<string[]>>()
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
    const text                = readFileSync(file, 'utf8')
    const { module, program } = parseSync(file, text)
    const found               = {
      site      : site(file, module),
      spellings : rooted(strings(program, Visitor)),
      imports   : imports(file, module, resolver, text)
        .filter((path) => !lockfile(path) && SCRIPT.test(path))
    }

    scans.set(file, found)

    return found
  }

  const markdown = changed.some((file) => file.endsWith('.md'))
  const resolved = (dir: string): Promise<string[]> => {
    const found = paged.get(dir) ?? pages(resolver, dir)

    paged.set(dir, found)

    return found
  }

  const reads = async (test: string): Promise<boolean> => {
    const modules = new Set([test])

    for (const module of modules) {
      const { imports, site, spellings } = scans.get(module) ?? scan(module)

      if (spellings.some((spelling) => targets.values().some((target) => names(target, spelling)))) {
        return true
      }

      if (site && markdown && (await resolved(site)).some((page) => targets.has(page))) {
        return true
      }

      imports.forEach((path) => modules.add(path))
    }

    return false
  }

  const tests = globSync(include, { cwd: root }).map((file) => join(root, file))
  const kept  = await Promise.all(tests.map(reads))

  return tests.filter((_, index) => kept[index])
}

/**
 * Lists the paths `texts` spell, per `spelled`, leaving out each holding white
 * space. A glob naming no directory outside its wildcards counts only joined
 * under each string of `texts` holding no wildcard, white space, or `$`, read
 * as the `cwd` of the call running it.
 */
function rooted(texts: string[]): string[] {
  const spellings = texts.flatMap(spelled).filter((spelling) => !/\s/.test(spelling))
  const dirs      = texts
    .filter((text) => !GLOB.test(text) && !/[\s$]/.test(text))
    .map((text) => text.split('/').filter((part) => !/^\.{0,2}$/.test(part)).join('/'))
    .filter(Boolean)

  return spellings.flatMap((spelling) =>
    !GLOB.test(spelling) || spelling.split('/').slice(0, -1).some((part) => !GLOB.test(part))
      ? [spelling]
      : dirs.map((dir) => `${dir}/${spelling}`)
  )
}

/**
 * Names the root of the VitePress site whose `.vitepress` directory holds
 * `file`, where `module` imports `resolveConfig` from `vitepress`, since the
 * `pages` that call resolves are each a page of that site.
 */
function site(file: string, module: Utils.ParseResult['module']): string | undefined {
  const root  = file.lastIndexOf(SITE)
  const calls = module.staticImports
    .filter(({ moduleRequest }) => moduleRequest.value === 'vitepress')
    .some(({ entries }) => entries.some(({ importName }) => importName.name === 'resolveConfig'))

  return root >= 0 && calls ? file.slice(0, root) : undefined
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
 * Lists the strings `program` holds:
 *
 * - Each string literal but the source of an import or export
 * - Each part of a template literal, and a template literal holding an
 *   expression read whole as a glob, `*` standing for each expression, where
 *   the glob holds a `/` and a segment that, once its extension drops off,
 *   holds a character other than `*` or `.`
 * - The run of string arguments ending each `join` or `resolve` call, joined
 *   by `/`
 */
function strings(program: Utils.ESTree.Program, Visitor: typeof Utils.Visitor): string[] {
  const found: string[] = []
  const sources         = new Set<number>()
  const source          = ({ source }: { source: Utils.ESTree.Expression | null }): void => {
    if (source) {
      sources.add(source.start)
    }
  }

  new Visitor({
    ExportAllDeclaration   : source,
    ExportNamedDeclaration : source,
    ImportDeclaration      : source,
    ImportExpression       : source,

    CallExpression: ({ arguments: args, callee }) => {
      const name   = callee.type === 'MemberExpression' && !callee.computed ? callee.property : callee
      const values = args.map((arg) =>
        arg.type === 'Literal' && typeof arg.value === 'string' ? arg.value : undefined
      )
      const parts  = values.slice(values.lastIndexOf(undefined) + 1)

      if (name.type === 'Identifier' && ['join', 'resolve'].includes(name.name) && parts.length) {
        found.push(parts.join('/'))
      }
    },

    Literal: ({ start, value }) => {
      if (typeof value === 'string' && !sources.has(start)) {
        found.push(value)
      }
    },

    TemplateElement: ({ value: { cooked } }) => {
      if (cooked) {
        found.push(cooked)
      }
    },

    TemplateLiteral: ({ expressions, quasis }) => {
      const glob  = quasis.map(({ value: { cooked } }) => cooked ?? '').join('*')
      const named = glob.split('/').some((part) => /[^*.]/.test(part.replace(/\.[^*.]*$/, '')))

      if (expressions.length && glob.includes('/') && named) {
        found.push(glob)
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
    const paths      = imports(file, module, resolver, text)
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
