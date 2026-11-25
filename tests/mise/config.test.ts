/** @module-tag spawns */
import { chmod }           from 'node:fs/promises'
import { delimiter, join } from 'node:path'

import { plant, test } from '../common/scratch.js'
import { spawned }     from '../common/sync.js'

const root   = join(import.meta.dirname, '..', '..')
const config = join(root, '.mise', 'config.toml')

test('runs each readiness check under mise doctor project, read from .mise/config.toml', async ({
  expect
}) => {
  // The report prints on either exit status, and the tools check fails on a runner missing a pinned tool
  const { stdout } = await spawned('mise', ['doctor', 'project', '--json'], { cwd: root, env: process.env })

  expect(JSON.parse(stdout)).toMatchObject({
    checks : ['bash', 'git', 'tar', 'tools'].map((name) => ({ name, source: config })),
    errors : []
  })
})

test('runs the tools check through mise ls --no-global, never the deprecated --local alias', async ({
  expect
}) => {
  // `mise usage` marks a deprecated flag only in its help text, so the case pins the whole line
  const args = ['config', 'get', '--file', config, 'doctor.checks.tools.run']
  const run  = await spawned('mise', args, { cwd: root, env: process.env })

  expect(run).toMatchObject({ status: 0, stdout: 'test -z "$(mise ls --missing --no-global --no-header)"\n' })
})

test.for([
  { release: '2.27.9', status: 'fail' },
  { release: '2.28.0', status: 'pass' },
  { release: '2.54.0', status: 'pass' }
])('reads Git $release as $status', async ({ release, status }, { expect, scratch }) => {
  await plant(scratch, { 'bin/git': `#!/bin/sh\necho 'git version ${release} (Fixture)'\n` })
  await chmod(join(scratch, 'bin', 'git'), 0o755)

  const env        = { ...process.env, PATH: join(scratch, 'bin') + delimiter + process.env.PATH }
  const { stdout } = await spawned('mise', ['doctor', 'project', '--json'], { cwd: root, env })

  expect(JSON.parse(stdout).checks).toContainEqual(expect.objectContaining({ name: 'git', status }))
})
