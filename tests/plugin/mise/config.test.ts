/** @module-tag spawns */
import { join } from 'node:path'

import { expect, it } from 'vitest'

import { spawned } from '../common/sync.js'
import { root }    from '../common/paths.js'
const config = join(root, '.mise', 'config.toml')

it('runs the tools check under mise doctor project, read from .mise/config.toml', async () => {
  // The report prints on either exit status, and the check fails on a runner missing a pinned tool
  const { stdout } = await spawned('mise', ['doctor', 'project', '--json'], { cwd: root, env: process.env })

  expect(JSON.parse(stdout)).toMatchObject({
    checks : [{ name: 'tools', source: config }],
    errors : []
  })
})

it('runs the tools check through mise ls --no-global, never the deprecated --local alias', async () => {
  // `mise usage` marks a deprecated flag only in its help text, so the case pins the whole line
  const args = ['config', 'get', '--file', config, 'doctor.checks.tools.run']
  const run  = await spawned('mise', args, { cwd: root, env: process.env })

  expect(run).toMatchObject({ status: 0, stdout: 'test -z "$(mise ls --missing --no-global --no-header)"\n' })
})
