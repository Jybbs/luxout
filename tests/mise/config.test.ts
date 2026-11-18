/** @module-tag spawns */
import { join } from 'node:path'

import { expect, it } from 'vitest'

import { spawned } from '../common/sync.js'

const root = join(import.meta.dirname, '..', '..')

it('runs the tools check under mise doctor project, read from .mise/config.toml', async () => {
  // The report prints on either exit status, and the check fails on a runner missing a pinned tool
  const { stdout } = await spawned('mise', ['doctor', 'project', '--json'], { cwd: root, env: process.env })

  expect(JSON.parse(stdout)).toMatchObject({
    checks : [{ name: 'tools', source: join(root, '.mise', 'config.toml') }],
    errors : []
  })
})
