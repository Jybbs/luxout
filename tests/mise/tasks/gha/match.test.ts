import { spawnSync } from 'node:child_process'
import { join }      from 'node:path'

import { expect } from 'vitest'

import { plant, test } from '../../../common/scratch.js'

const task = join(import.meta.dirname, '..', '..', '..', '..', '.mise', 'tasks', 'gha', 'match')

async function match(scratch: string, tag: string | undefined, version: string) {
  await plant(scratch, { 'package.json': JSON.stringify({ version }) })

  const { status, stderr } = spawnSync(task, {
    cwd      : scratch,
    encoding : 'utf8',
    env      : { ...process.env, GITHUB_REF_NAME: tag }
  })

  return { status, stderr }
}

test('passes where the release tag equals the version package.json carries', async ({ scratch }) => {
  expect(await match(scratch, '0.1.0', '0.1.0')).toEqual({ status: 0, stderr: '' })
})

test('fails where no release tag is set', async ({ scratch }) => {
  const { status, stderr } = await match(scratch, undefined, '0.1.0')

  expect({ status, stderr }).toEqual({
    status : 1,
    stderr : expect.stringContaining('GITHUB_REF_NAME: unbound variable')
  })
})

test.for([
  { tag: '0.1.1', version: '0.1.0' },
  { tag: 'v0.1.0', version: '0.1.0' }
])('fails where the tag $tag differs from the version $version', async ({ tag, version }, { scratch }) => {
  expect(await match(scratch, tag, version)).toEqual({
    status : 1,
    stderr : `package.json carries version ${version}, whereas the release is tagged ${tag}\n`
  })
})
