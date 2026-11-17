import { execFileSync }                                   from 'node:child_process'
import { globSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { createRequire, findPackageJSON }                 from 'node:module'
import { dirname, join, resolve, sep }                    from 'node:path'
import { pathToFileURL }                                  from 'node:url'

import type * as Experimental from 'rolldown/experimental'
import type * as Utils        from 'rolldown/utils'
import stripJsonComments      from 'strip-json-comments'

/**
 * The fields of a tsconfig that name other tsconfig files.
 */
interface Tsconfig {
  extends?    : string | string[]
  references? : { path: string }[]
}

const MODULES = `${sep}node_modules${sep}`
const SCRIPT  = /\.[cm]?[jt]sx?$/

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

  const { error, path } = extender.sync(dir, base)

  if (path === undefined) {
    throw new Error(`${base} in ${dir}: ${error}`)
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
 * Lists the files a suite reads beside the modules it imports, following each
 * import from the test files `include` matches under `root` through every
 * module outside `node_modules`.
 *
 * Args:
 *   include : The suite's test file globs, relative to `root`.
 *   root    : The suite's root directory.
 *
 * Returns:
 *   The absolute path of each tsconfig Vite's transform tests for a module
 *   and the files its `extends` chain names, the path a `tsconfig.json`
 *   takes in each directory the transform walks, the path a `package.json`
 *   takes in each directory from the module's own up to the nearest one, the
 *   `bun.lock` beside each `node_modules` an import resolves through, and
 *   this file.
 */
export function triggers(root: string, include: string[]): string[] {
  const require = vite(root)

  const { ResolverFactory, resolveTsconfig } = require('rolldown/experimental') as typeof Experimental
  const { TsconfigCache, parseSync }         = require('rolldown/utils') as typeof Utils

  const cache    = new TsconfigCache()
  const modules  = new Set(globSync(include, { cwd: root }).map((file) => join(root, file)))
  const reads    = new Set([import.meta.filename])
  const resolver = new ResolverFactory({
    conditionNames : ['node', 'import'],
    extensionAlias : { '.js': ['.ts', '.js'] },
    symlinks       : false
  })
  const extender = resolver.cloneWithOptions({
    conditionNames : ['node', 'import'],
    extensions     : ['.json'],
    mainFiles      : ['tsconfig'],
    symlinks       : false
  })

  for (const file of modules) {
    const text       = readFileSync(file, 'utf8')
    const { module } = parseSync(file, text)
    const requests   = new Set([
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

    const tsconfigs = resolveTsconfig(file, cache)?.tsconfigFilePaths ?? []
    const paths     = [...requests]
      .map((request) => resolver.sync(dirname(file), request).path)
      .filter((path) => path !== undefined)
    const settings  = [
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
      }
    }
  }

  return [...reads]
}

/**
 * Creates a `require` resolving from the Vite that Vitest loads under `root`,
 * whose `rolldown` reads each tsconfig its transform applies.
 */
export function vite(root: string): NodeJS.Require {
  const base = createRequire(join(root, 'package.json'))

  return ['vitest', 'vite'].reduce((from, id) => createRequire(from.resolve(id)), base)
}
