import { expect } from 'vitest'

import { plant, test } from '../../../common/scratch.js'
import { sync }        from '../../../common/sync.js'

const CALLS = [
  ['bun', 'install', '--cwd', '.', '--dry-run', '--frozen-lockfile'],
  ['bun', 'install', '--cwd', 'site', '--dry-run', '--frozen-lockfile'],
  ['bun', 'install', '--cwd', 'tests/homebridge', '--dry-run', '--frozen-lockfile'],
  ['mise', 'lock'],
  ['mise', 'install', '--dry-run', '--force', '--locked']
]

test('checks the Bun lockfiles of the package, the site, and the UI before the mise lockfile', async ({
  scratch
}) => {
  await plant(scratch, { '.mise/mise.lock': 'locked\n' })

  const { invoked, status } = await sync(scratch, 'lock:check', {
    canned: Object.fromEntries(CALLS.map((call) => [call.join(' '), {}]))
  })

  expect({ calls: invoked.map((call) => call.args), status }).toEqual({ calls: CALLS, status: 0 })
})
