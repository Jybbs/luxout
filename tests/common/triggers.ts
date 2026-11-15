import { execFileSync }                                   from 'node:child_process'
import { globSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { createRequire, findPackageJSON }                 from 'node:module'
import { dirname, join, resolve, sep }                    from 'node:path'
import { pathToFileURL }                                  from 'node:url'

import type * as Experimental from 'rolldown/experimental'
import type * as Utils        from 'rolldown/utils'
import stripJsonComments      from 'strip-json-comments'

const MODULES = `${sep}node_modules${sep}`
const SCRIPT  = /\.[cm]?[jt]sx?$/

/**
 * Lists `file` and its real path beside each file its `extends` chain names,
 * which the `tsconfigFilePaths` of `resolveTsconfig` leaves out, reading each
 * as rolldown does, where comments, trailing commas, a byte order mark, and an
 * empty file all parse. A file under `node_modules` stands as the `bun.lock`
 * that installs it, and so does a real path under one.
 */
function chain(file: string, extender: Experimental.ResolverFactory): string[] {
  const lock = lockfile(file)

  if (lock) {
    return [lock]
  }

  const dir                     = dirname(file)
  const text                    = stripJsonComments(readFileSync(file, 'utf8'), { trailingCommas: true })
  const { extends: bases = [] } = JSON.parse(text.trim() || '{}') as { extends?: string | string[] }
  const paths                   = [bases].flat().map((base) => extended(base, dir, extender))
  const real                    = realpathSync(file)

  return [file, lockfile(real) ?? real, ...paths.flatMap((path) => chain(path, extender))]
}

/**
 * Resolves the `extends` entry `base` of a tsconfig in `dir` as rolldown does,
 * taking a path that opens on `.` or `/` as the file it names, the
 * `tsconfig.json` inside the directory it names, or that path with `.json`
 * added, and resolving any other entry through `extender`.
 */
function extended(base: string, dir: string, extender: Experimental.ResolverFactory): string {
  if (/^[./]/.test(base)) {
    const path = resolve(dir, base)
    const stat = statSync(path, { throwIfNoEntry: false })

    if (stat?.isDirectory()) {
      return join(path, 'tsconfig.json')
    }

    return stat?.isFile() ? path : `${path}.json`
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
 * Lists the path a file called `name` takes in `dir` and in each directory
 * above it, up to the path `found` or, where `found` is unset, up to the
 * filesystem root.
 */
function lookups(dir: string, name: string, found?: string): string[] {
  const path = join(dir, name)

  return path === found || dir === dirname(dir) ? [path] : [path, ...lookups(dirname(dir), name, found)]
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
 *   The absolute path of each module's nearest `tsconfig.json` and the files
 *   its `extends` chain names, as Vite's transform resolves them, the path
 *   a `tsconfig.json` or `package.json` takes in each directory from the
 *   module's own up to the nearest one, the `bun.lock` beside each
 *   `node_modules` an import resolves through, and this file.
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
      ...tsconfigs.flatMap((tsconfig) => chain(tsconfig, extender)),
      ...lookups(dirname(file), 'package.json', findPackageJSON(pathToFileURL(file))),
      ...lookups(dirname(file), 'tsconfig.json', tsconfigs[0])
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
