/** @module-tag spawns */
import { copyFile, readFile, readdir, symlink } from 'node:fs/promises'
import { join }                                 from 'node:path'

import { expect } from 'vitest'

import { plant, test } from '../../../common/scratch.js'
import { sync }        from '../../../common/sync.js'

const root = join(import.meta.dirname, '..', '..', '..', '..')

test('bundles the settings page’s script with its packages beside the page', async ({ scratch }) => {
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

test('leaves no dist behind a compile that fails', async ({ scratch }) => {
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
