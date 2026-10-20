import { expect } from 'vitest'

import { plant, test } from '../../../common/scratch.js'
import { sync }        from '../../../common/sync.js'

const BAKE = [
  ['bun', 'install', '--lockfile-only'],
  ['bun', 'install', '--cwd', 'site', '--lockfile-only']
]
const LOCK = [['mise', 'lock'], ['mise', 'ls', '--json', '--local', '--missing']]

/**
 * Runs the task in `scratch` under stand-ins for `mise` and `bun`, where
 * `mise ls` reports `missing` as the tools the local mise config pins that
 * mise has not installed.
 *
 * Returns:
 *   Each call the stand-ins received, in order, beside the exit status.
 */
async function relock(
  missing : string[],
  scratch : string
): Promise<{ calls: string[][], status: number | null }> {
  const lacking = Object.fromEntries(missing.map((tool) => [tool, []]))

  await plant(scratch, { '.mise/mise.lock': '[[tools.bun]]\nversion = "1.4.2"\n' })

  const { invoked, status } = await sync(scratch, 'lock:sync', {
    canned: {
      'bun install --cwd site --lockfile-only' : {},
      'bun install --lockfile-only'            : {},
      [['mise install', ...missing].join(' ')] : {},
      'mise lock'                              : {},
      'mise ls --json --local --missing'       : { stdout: JSON.stringify(lacking) }
    }
  })

  return { calls: invoked.map(({ args }) => args), status }
}

test('locks mise first and installs each missing tool before either Bun package relocks', async ({
  scratch
}) => {
  expect(await relock(['bun', 'zizmor'], scratch)).toEqual({
    calls  : [...LOCK, ['mise', 'install', 'bun', 'zizmor'], ...BAKE],
    status : 0
  })
})

test('installs nothing where no tool the local mise config pins is missing', async ({ scratch }) => {
  expect(await relock([], scratch)).toEqual({ calls: [...LOCK, ...BAKE], status: 0 })
})
