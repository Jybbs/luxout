/** @module-tag spawns */
import { describe } from 'vitest'

import { test }                     from '../../../common/scratch.js'
import { type SyncRun, info, sync } from '../../../common/sync.js'

const PLUGIN = ['mise', 'run', 'plugin:affected']
const SITE   = ['mise', 'run', 'site:affected']

/**
 * Runs the task in `scratch` beside a stand-in for `mise`, where the call
 * `failing` names exits 1.
 */
function run(scratch: string, failing?: string[]): Promise<SyncRun> {
  return sync(scratch, 'repo:check', {
    canned : {
      [PLUGIN.join(' ')] : {},
      [SITE.join(' ')]   : {},
      ...failing && { [failing.join(' ')]: { status: 1 } }
    }
  })
}

describe.concurrent('repo:check', () => {
  test('runs the audit and every type and lint check before its own body', async ({ expect }) => {
    expect(await info('repo:check')).toMatchObject({
      aliases : ['check'],
      depends : ['plugin:lint', 'plugin:typecheck', 'repo:audit', 'site:lint', 'site:typecheck']
    })
  })

  test('runs the plugin tests and then the site tests a branch reaches', async ({ expect, scratch }) => {
    expect(await run(scratch)).toMatchObject({ commands: [PLUGIN, SITE], status: 0 })
  })

  test.for([
    { commands: [PLUGIN], failing: PLUGIN, name: '`plugin:affected`' },
    { commands: [PLUGIN, SITE], failing: SITE, name: '`site:affected`' }
  ])('fails and runs nothing further once $name fails', async ({ commands, failing }, {
    expect,
    scratch
  }) => {
    expect(await run(scratch, failing)).toMatchObject({ commands, status: 1 })
  })
})
