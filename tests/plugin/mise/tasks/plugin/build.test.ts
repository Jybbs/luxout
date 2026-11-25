/** @module-tag spawns */
import { copyFile, cp, readFile, readdir, stat, symlink, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe } from 'vitest'

import { root }        from '../../../common/paths.js'
import { plant, test } from '../../../common/scratch.js'
import { mised, sync } from '../../../common/sync.js'

const LATER = new Date('2030-01-01T00:00:00Z')

/**
 * Plants a checkout in `scratch` holding the repository's mise config, its
 * lockfile, its wrappers, and `plugin:build` alone, beside a source tree that
 * compiles, and builds it once through `mise run`.
 *
 * Returns:
 *   A runner that builds the checkout again through `mise run`, skipping
 *   `plugin:bake`.
 */
async function checkout(scratch: string): Promise<() => Promise<string>> {
  await plant(scratch, {
    'package.json'             : '{ "type": "module" }',
    'src/index.ts'             : 'export const lux = 1\n',
    'src/ui/public/index.css'  : '',
    'src/ui/public/index.html' : '',
    'src/ui/public/index.ts'   : "document.title = 'Fixture'\n"
  })
  await Promise.all([
    ...['bin', 'config.toml', 'mise.lock', 'tasks/plugin/build'].map((path) =>
      cp(join(root, '.mise', path), join(scratch, '.mise', path), { recursive: true })),
    copyFile(join(root, 'src', 'tsconfig.json'), join(scratch, 'src', 'tsconfig.json')),
    symlink(join(root, 'node_modules'), join(scratch, 'node_modules'))
  ])

  const build = async (): Promise<string> => {
    const { status, stderr } = await mised(scratch, ['run', '--skip-deps', 'plugin:build'])

    if (status !== 0) throw new Error(stderr)

    return readFile(join(scratch, 'dist', 'index.js'), 'utf8')
  }

  await build()

  return build
}

describe.concurrent('plugin:build', () => {
  test('bundles the settings page’s script with its packages beside the page', async ({
    expect,
    scratch
  }) => {
    await plant(scratch, {
      'package.json'             : '{ "type": "module" }',
      'src/index.ts'             : 'export const lux = 1\n',
      'src/ui/public/index.css'  : '',
      'src/ui/public/index.html' : '',
      'src/ui/public/index.ts'   : "import { collection } from '@zag-js/listbox'\n\n"
                                 + 'document.title = String(collection.empty().size)\n'
    })
    await copyFile(join(root, 'src', 'tsconfig.json'), join(scratch, 'src', 'tsconfig.json'))
    await symlink(join(root, 'node_modules'), join(scratch, 'node_modules'))

    const { status } = await sync(scratch, 'plugin:build')
    const page       = join(scratch, 'dist', 'ui', 'public')

    expect({ files: (await readdir(page)).toSorted(), status }).toEqual({
      files  : ['index.css', 'index.html', 'index.js'],
      status : 0
    })
    expect(await readFile(join(page, 'index.js'), 'utf8')).not.toMatch(/@zag-js\//)
  })

  test('leaves no dist behind a compile that fails', async ({ expect, scratch }) => {
    await plant(scratch, {
      'dist/index.js' : '',
      'package.json'  : '{ "type": "module" }',
      'src/index.ts'  : 'export const lux: number = "dark"\n'
    })
    await copyFile(join(root, 'src', 'tsconfig.json'), join(scratch, 'src', 'tsconfig.json'))
    await symlink(join(root, 'node_modules'), join(scratch, 'node_modules'))

    const { status } = await sync(scratch, 'plugin:build')

    expect({ files: await readdir(scratch), status }).toEqual({
      files  : expect.not.arrayContaining(['dist']),
      status : 1
    })
  })

  test('skips the build where a source moves to a later file time with its contents unchanged', async ({
    expect,
    scratch
  }) => {
    const build = await checkout(scratch)
    const built = (await stat(join(scratch, 'dist', 'index.js'))).mtimeMs

    await utimes(join(scratch, 'src', 'index.ts'), LATER, LATER)
    await build()

    expect((await stat(join(scratch, 'dist', 'index.js'))).mtimeMs).toBe(built)
  })

  test('rebuilds where a source changes contents under the file time it had', async ({ expect, scratch }) => {
    const build  = await checkout(scratch)
    const source = join(scratch, 'src', 'index.ts')
    const before = await stat(source)

    await writeFile(source, 'export const lux = 2\n')
    await utimes(source, before.atime, before.mtime)

    expect(await build()).toMatch(/lux = 2/)
  })
})
