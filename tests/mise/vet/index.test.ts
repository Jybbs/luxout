/** @module-tag spawns */
import { spawnSync } from 'node:child_process'
import { join }      from 'node:path'

import { expect } from 'vitest'

import schema          from '../../../config.schema.json' with { type: 'json' }
import { plant, test } from '../../common/scratch.js'
import { install }     from '../../common/vet.js'

const entry = join(import.meta.dirname, '..', '..', '..', '.mise', 'vet', 'index.ts')

test('runs under Node’s type stripping and exits 0 with no release to start', async ({ scratch }) => {
  await plant(scratch, { 'config.schema.json': JSON.stringify(schema) })

  const { status, stdout } = spawnSync(process.execPath, [entry], {
    cwd      : scratch,
    encoding : 'utf8'
  })

  expect({ status, stdout }).toEqual({ status: 0, stdout: '' })
})

test('exits 1 on a release that never starts, naming each check it fails', async ({ scratch }) => {
  await plant(scratch, { 'config.schema.json': JSON.stringify(schema) })
  await install(join(scratch, 'pinned'), '2.4.0')
  await plant(scratch, { 'pinned/node_modules/.bin/homebridge': 'process.exit(3)\n' })

  const { status, stdout } = spawnSync(process.execPath, [entry, 'pinned'], {
    cwd      : scratch,
    encoding : 'utf8'
  })

  expect({ status, stdout }).toEqual({
    status : 1,
    stdout : expect.stringContaining(
      'Homebridge 2.4.0, no config: fails, since it never reports its bridge listening '
    + 'and exits before it is stopped\n'
    )
  })
})
