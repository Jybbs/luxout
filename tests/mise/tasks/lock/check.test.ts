/** @module-tag spawns */
import { describe, expect } from 'vitest'

import { plant, test } from '../../../common/scratch.js'
import { sync }        from '../../../common/sync.js'

const CALLS = [
  ...['.', 'site', 'tests/homebridge', 'tests/vet/floor', 'tests/vet/pinned']
    .map((dir) => ['bun', 'install', '--cwd', dir, '--dry-run', '--frozen-lockfile']),
  ['mise', 'lock'],
  ['mise', 'install', '--dry-run', '--force', '--locked']
]
const VET = { 'tests/vet/floor/package.json': '{}\n', 'tests/vet/pinned/package.json': '{}\n' }

describe.concurrent('lock:check', () => {
  test('checks the Bun lockfile of every package .mise/lib/lock.sh lists before the mise lockfile', async ({
    scratch
  }) => {
    await plant(scratch, { ...VET, '.mise/mise.lock': 'locked\n' })

    expect(await sync(scratch, 'lock:check', {
      canned: Object.fromEntries(CALLS.map((call) => [call.join(' '), {}]))
    })).toMatchObject({ commands: CALLS, status: 0 })
  })
})
