import { cp }   from 'node:fs/promises'
import { join } from 'node:path'

import { expect } from 'vitest'

import { test } from '../../../common/scratch.js'
import { sync } from '../../../common/sync.js'

const ARGS    = ['--bail', '1']
const MESSAGE = 'plugin:test:24 runs on Node 24.21.0, which mise has not installed, '
              + 'so run `mise install --include-task-tools` first\n'
const VITEST  = ['run', '--config', 'tests/vitest.config.ts', ...ARGS]

/**
 * Runs the task as `name` in `scratch` beside stand-ins for the programs it
 * calls, where `mise` reports the task declaring `tools` or fails without them,
 * `node` reports the `running` release or fails without one, and `vitest`
 * prints its arguments.
 */
async function run(
  name    : string,
  running : string,
  scratch : string,
  tools?  : Record<string, string>
): Promise<{ status: number | null, stderr: string, vitest: string[] }> {
  await cp(join(import.meta.dirname, '..', '..', 'fixtures', 'args.sh'), join(scratch, 'bin', 'vitest'))

  const { status, stderr, stdout } = await sync(scratch, 'plugin:test', {
    args   : ARGS,
    env    : { MISE_TASK_NAME: name },
    canned : {
      [`mise tasks info --json ${name}`] : tools ? { stdout: JSON.stringify({ tools }) } : { status: 1 },
      'node --version'                   : running ? { stdout: running } : { status: 127 }
    }
  })

  return { status, stderr, vitest: stdout.split('\0').slice(1, -1) }
}

test('runs Vitest with every argument where the task declares no release of Node', async ({ scratch }) => {
  expect(await run('plugin:test', 'v26.10.0', scratch, {})).toEqual({ status: 0, stderr: '', vitest: VITEST })
})

test('runs Vitest where the running Node is the release the task declares', async ({ scratch }) => {
  expect(await run('plugin:test:24', 'v24.21.0', scratch, { node: '24.21.0' }))
    .toEqual({ status: 0, stderr: '', vitest: VITEST })
})

test.for([
  { name: 'another release of Node', running: 'v26.10.0' },
  { name: 'another release of the same line', running: 'v24.21.1' },
  { name: 'a node that fails to run', running: '' }
])('fails before Vitest starts where the path holds $name', async ({ running }, { scratch }) => {
  expect(await run('plugin:test:24', running, scratch, { node: '24.21.0' }))
    .toEqual({ status: 1, stderr: MESSAGE, vitest: [] })
})

test('fails before Vitest starts where mise cannot read the task', async ({ scratch }) => {
  expect(await run('plugin:test:24', 'v24.21.0', scratch)).toEqual({ status: 1, stderr: '', vitest: [] })
})
