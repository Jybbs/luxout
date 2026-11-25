/** @module-tag spawns */
import { describe } from 'vitest'

import { test }                     from '../../../common/scratch.js'
import { type SyncRun, info, sync } from '../../../common/sync.js'

const CHECKS = ['lock:check', 'plugin:lint', 'plugin:typecheck', 'repo:audit', 'site:lint', 'site:typecheck']
const DOCTOR = ['mise', 'doctor', 'project']
const PLUGIN = ['mise', 'run', 'plugin:affected']
const SITE   = ['mise', 'run', 'site:affected']
const STATIC = ['mise', 'run', ...CHECKS.flatMap((check) => [':::', check]).slice(1)]

/**
 * Runs the task in `scratch` beside a stand-in for `mise`, where the call
 * `failing` names exits 1.
 */
function run(scratch: string, failing?: string[]): Promise<SyncRun> {
  return sync(scratch, 'repo:check', {
    canned : {
      ...Object.fromEntries([DOCTOR, STATIC, PLUGIN, SITE].map((call) => [call.join(' '), {}])),
      ...failing && { [failing.join(' ')]: { status: 1 } }
    }
  })
}

describe.concurrent('repo:check', () => {
  test('runs every step in its own body, with no dependency running ahead of the readiness checks', async ({
    expect
  }) => {
    expect(await info('repo:check')).toMatchObject({ aliases: ['check'], depends: [] })
  })

  test('runs the readiness checks, then the static checks, then the tests a branch reaches', async ({
    expect,
    scratch
  }) => {
    expect(await run(scratch)).toMatchObject({ commands: [DOCTOR, STATIC, PLUGIN, SITE], status: 0 })
  })

  test.for([
    { commands: [DOCTOR], failing: DOCTOR, name: '`mise doctor project`' },
    { commands: [DOCTOR, STATIC], failing: STATIC, name: 'a static check' },
    { commands: [DOCTOR, STATIC, PLUGIN], failing: PLUGIN, name: '`plugin:affected`' },
    { commands: [DOCTOR, STATIC, PLUGIN, SITE], failing: SITE, name: '`site:affected`' }
  ])('fails and runs nothing further once $name fails', async ({ commands, failing }, {
    expect,
    scratch
  }) => {
    expect(await run(scratch, failing)).toMatchObject({ commands, status: 1 })
  })
})
