import { spawnSync }       from 'node:child_process'
import { cp }              from 'node:fs/promises'
import { delimiter, join } from 'node:path'

import { expect } from 'vitest'

import { test } from '../../../common/scratch.js'

const ARGS     = ['--bail', '1']
const FIXTURES = join(import.meta.dirname, '..', '..', 'fixtures')
const MESSAGE  = 'plugin:test:24 runs on Node 24.21.0, which mise has not installed, '
               + 'so run `mise install --include-task-tools` first\n'
const TASK   = join(import.meta.dirname, '..', '..', '..', '..', '.mise', 'tasks', 'plugin', 'test')
const VITEST = ['vitest', 'run', '--config', 'tests/vitest.config.ts', ...ARGS]

/**
 * Runs the task as `name` in `scratch` beside stand-ins for the programs it
 * calls, where `mise` reports the task declaring `tools` or fails without them,
 * `node` reports the `running` release, and `vitest` prints its arguments.
 */
async function run(
  name    : string,
  running : string,
  scratch : string,
  tools?  : Record<string, string>
): Promise<{ status: number | null, stderr: string, vitest: string[] }> {
  await Promise.all([
    cp(join(FIXTURES, 'args.sh'), join(scratch, 'bin', 'vitest')),
    cp(join(FIXTURES, 'mise.sh'), join(scratch, 'bin', 'mise')),
    cp(join(FIXTURES, 'node.sh'), join(scratch, 'bin', 'node'))
  ])

  const { status, stderr, stdout } = spawnSync(TASK, ARGS, {
    cwd      : scratch,
    encoding : 'utf8',
    env      : {
      MISE_TASK_INFO : tools ? JSON.stringify({ tools }) : '',
      MISE_TASK_NAME : name,
      NODE_VERSION   : running,
      PATH           : join(scratch, 'bin') + delimiter + process.env.PATH
    }
  })

  return { status, stderr, vitest: stdout.split('\0').slice(0, -1) }
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
  { name: 'a node that fails to run', running: '' }
])('fails before Vitest starts where the path holds $name', async ({ running }, { scratch }) => {
  expect(await run('plugin:test:24', running, scratch, { node: '24.21.0' }))
    .toEqual({ status: 1, stderr: MESSAGE, vitest: [] })
})

test('fails before Vitest starts where mise cannot read the task', async ({ scratch }) => {
  expect(await run('plugin:test:24', 'v24.21.0', scratch)).toEqual({ status: 1, stderr: '', vitest: [] })
})
