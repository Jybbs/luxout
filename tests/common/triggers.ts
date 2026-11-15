import { execFileSync }           from 'node:child_process'
import { globSync, readFileSync } from 'node:fs'
import { findPackageJSON }        from 'node:module'
import { dirname, join, sep }     from 'node:path'
import { pathToFileURL }          from 'node:url'

import { ResolverFactory, resolveTsconfig } from 'rolldown/experimental'
import { TsconfigCache, parseSync }         from 'rolldown/utils'

const MODULES = `${sep}node_modules${sep}`
const SCRIPT  = /\.[cm]?[jt]sx?$/

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
 *   The absolute path of each module's `tsconfig.json` and the files its
 *   `extends` chain names, as Vite's transform resolves them, the
 *   `package.json` nearest each module, the `bun.lock` beside each
 *   `node_modules` an import resolves through, and this file.
 */
export function triggers(root: string, include: string[]): string[] {
  const cache    = new TsconfigCache()
  const modules  = new Set(globSync(include, { cwd: root }).map((file) => join(root, file)))
  const reads    = new Set([import.meta.filename])
  const resolver = new ResolverFactory({
    conditionNames : ['node', 'import'],
    extensionAlias : { '.js': ['.ts', '.js'] },
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

    const scope = findPackageJSON(pathToFileURL(file))
    const paths = [...requests]
      .map((request) => resolver.sync(dirname(file), request).path)
      .filter((path) => path !== undefined)

    resolveTsconfig(file, cache)?.tsconfigFilePaths.forEach((path) => reads.add(path))

    if (scope) {
      reads.add(scope)
    }

    for (const path of paths) {
      const owner = path.lastIndexOf(MODULES)

      if (owner >= 0) {
        reads.add(join(path.slice(0, owner), 'bun.lock'))
      } else if (SCRIPT.test(path)) {
        modules.add(path)
      }
    }
  }

  return [...reads]
}
