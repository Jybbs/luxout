import { spawnSync }            from 'node:child_process'
import { cp }                   from 'node:fs/promises'
import { delimiter, join, sep } from 'node:path'

import { expect } from 'vitest'

import { plant, test } from '../../../common/scratch.js'

const printer = join(import.meta.dirname, '..', '..', 'fixtures', 'args.sh')
const task    = join(import.meta.dirname, '..', '..', '..', '..', '.mise', 'tasks', 'lock', 'check')

test('checks the Bun lockfiles of the package, the site, and the UI before the mise lockfile', async ({
  scratch
}) => {
  const bin = join(scratch, 'bin')

  await plant(scratch, { '.mise/mise.lock': 'locked\n' })
  await Promise.all(['bun', 'mise'].map((name) => cp(printer, join(bin, name))))

  const { status, stdout } = spawnSync(task, {
    cwd      : scratch,
    encoding : 'utf8',
    env      : { PATH: bin + delimiter + process.env.PATH }
  })

  const calls = stdout.split(bin + sep)
    .slice(1)
    .map((call) => call.split('\0').slice(0, -1))

  expect({ calls, status }).toEqual({
    status : 0,
    calls  : [
      ['bun', 'install', '--dry-run', '--frozen-lockfile'],
      ['bun', 'install', '--cwd', 'site', '--dry-run', '--frozen-lockfile'],
      ['bun', 'install', '--cwd', 'tests/homebridge', '--dry-run', '--frozen-lockfile'],
      ['mise', 'install', '--dry-run', '--force', '--locked']
    ]
  })
})
