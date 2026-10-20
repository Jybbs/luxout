import { spawnSync }                  from 'node:child_process'
import { copyFile, readdir, symlink } from 'node:fs/promises'
import { delimiter, join }            from 'node:path'

import { expect } from 'vitest'

import { plant, test } from '../../../common/scratch.js'

const root = join(import.meta.dirname, '..', '..', '..', '..')
const task = join(root, '.mise', 'tasks', 'plugin', 'build')

test('leaves no dist behind a compile that fails', async ({ scratch }) => {
  await plant(scratch, {
    'package.json' : '{ "type": "module" }',
    'src/index.ts' : 'export const lux: number = "dark"\n'
  })
  await copyFile(join(root, 'src', 'tsconfig.json'), join(scratch, 'src', 'tsconfig.json'))
  await symlink(join(root, 'node_modules'), join(scratch, 'node_modules'))

  const { status } = spawnSync(task, {
    cwd : scratch,
    env : { PATH: join(root, 'node_modules', '.bin') + delimiter + process.env.PATH }
  })

  expect({ files: await readdir(scratch), status }).toEqual({
    files  : expect.not.arrayContaining(['dist']),
    status : 1
  })
})
