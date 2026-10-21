import { copyFile, readdir, symlink } from 'node:fs/promises'
import { join }                       from 'node:path'

import { expect } from 'vitest'

import { plant, test } from '../../../common/scratch.js'
import { sync }        from '../../../common/sync.js'

const root = join(import.meta.dirname, '..', '..', '..', '..')

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
