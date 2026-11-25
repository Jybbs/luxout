/** @module-tag spawns */
import { chmod, readFile } from 'node:fs/promises'
import { delimiter, join } from 'node:path'

import { parse } from 'yaml'

import { plant, test } from '../common/scratch.js'
import { spawned }     from '../common/sync.js'

interface Action {
  runs: { steps: { run?: string }[] }
}

const root      = join(import.meta.dirname, '..', '..')
const config    = join(root, '.mise', 'config.toml')
const provision = join(root, '.github', 'actions', 'provision', 'action.yml')
const ready     = (parse(await readFile(provision, 'utf8')) as Action).runs.steps.at(-1)?.run ?? ''

/**
 * Runs the provision action's readiness step as a `shell: bash` step runs it,
 * with `scratch` as `RUNNER_TEMP`, under a stand-in `mise` that prints `report`
 * and exits 1.
 */
async function readiness(scratch: string, report: string) {
  await plant(scratch, { 'bin/mise': `#!/bin/sh\nprintf '%s' '${report}'\nexit 1\n` })
  await chmod(join(scratch, 'bin', 'mise'), 0o755)

  return spawned('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', ready], {
    cwd : scratch,
    env : { ...process.env, PATH: join(scratch, 'bin') + delimiter + process.env.PATH, RUNNER_TEMP: scratch }
  })
}

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
  { name: 'Git 2.27.9', script: "echo 'git version 2.27.9 (Fixture)'", status: 'fail' },
  { name: 'Git 2.28.0', script: "echo 'git version 2.28.0 (Fixture)'", status: 'pass' },
  { name: 'Git 2.100.0', script: "echo 'git version 2.100.0 (Fixture)'", status: 'pass' },
  { name: 'a git printing no version', script: 'exit 1', status: 'fail' }
])('reads $name as $status', async ({ script, status }, { expect, scratch }) => {
  await plant(scratch, { 'bin/git': `#!/bin/sh\n${script}\n` })
  await chmod(join(scratch, 'bin', 'git'), 0o755)

  const env        = { ...process.env, PATH: join(scratch, 'bin') + delimiter + process.env.PATH }
  const { stdout } = await spawned('mise', ['doctor', 'project', '--json'], { cwd: root, env })

  expect(JSON.parse(stdout).checks).toContainEqual(expect.objectContaining({ name: 'git', status }))
})

test.for([{ name: 'bash' }, { name: 'tar' }])('runs the $name check through command -v', async ({ name }, {
  expect
}) => {
  const args = ['config', 'get', '--file', config, `doctor.checks.${name}.run`]

  expect(await spawned('mise', args, { cwd: root, env: process.env }))
    .toMatchObject({ status: 0, stdout: `command -v ${name}\n` })
})

test.for([
  { failing: 'git', name: 'a failing git check', status: 1 },
  { failing: 'tools', name: 'a failing tools check alone', status: 0 }
])('provisions a job to exit $status on $name', async ({ failing, status }, { expect, scratch }) => {
  const report = JSON.stringify({ checks: [{ hint: 'Install it.', name: failing, status: 'fail' }], errors: [] })

  expect(await readiness(scratch, report)).toMatchObject({ status })
})

test('fails a provisioned job where mise writes no readiness report', async ({ expect, scratch }) => {
  expect((await readiness(scratch, '')).status).not.toBe(0)
})
