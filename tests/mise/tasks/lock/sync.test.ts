/** @module-tag spawns */
import { describe } from 'vitest'

import { PACKAGES, VET }      from '../../../common/mise.js'
import { plant, test }        from '../../../common/scratch.js'
import { type SyncRun, sync } from '../../../common/sync.js'

const BAKE    = PACKAGES.map((dir) => ['bun', 'install', '--cwd', dir, '--lockfile-only'])
const MISSING = ['mise', 'ls', '--json', '--missing', '--no-global']
const LOCK    = [['mise', 'lock'], MISSING]

/**
 * Runs the task in `scratch` under stand-ins for `mise` and `bun`, where
 * `mise ls` reports `missing` as the tools the local mise config pins that
 * mise has not installed.
 *
 * Returns:
 *   The run, whose `commands` hold each call the stand-ins received, in order.
 */
async function relock(missing: string[], scratch: string): Promise<SyncRun> {
  const lacking = Object.fromEntries(missing.map((tool) => [tool, []]))

  await plant(scratch, { ...VET, '.mise/mise.lock': '[[tools.bun]]\nversion = "1.4.2"\n' })

  return sync(scratch, 'lock:sync', {
    canned: {
      ...Object.fromEntries(BAKE.map((call) => [call.join(' '), {}])),
      [['mise install', ...missing].join(' ')] : {},
      'mise lock'                              : {},
      [MISSING.join(' ')]                      : { stdout: JSON.stringify(lacking) }
    }
  })
}

describe.concurrent('lock:sync', () => {
  test('locks mise first and installs each missing tool before any Bun package relocks', async ({
    expect,
    scratch
  }) => {
    expect(await relock(['bun', 'zizmor'], scratch)).toMatchObject({
      commands : [...LOCK, ['mise', 'install', 'bun', 'zizmor'], ...BAKE],
      status   : 0
    })
  })

  test('installs nothing where no tool the local mise config pins is missing', async ({
    expect,
    scratch
  }) => {
    expect(await relock([], scratch)).toMatchObject({ commands: [...LOCK, ...BAKE], status: 0 })
  })
})
