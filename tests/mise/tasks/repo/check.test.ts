/** @module-tag spawns */
import { execFileSync } from 'node:child_process'
import { join }         from 'node:path'

import { expect } from 'vitest'

import { test } from '../../../common/scratch.js'
import { sync } from '../../../common/sync.js'

const BASE   = '5cb3ee2'
const MERGE  = ['git', 'merge-base', 'origin/main', 'HEAD']
const PLUGIN = ['mise', 'run', 'plugin:test', '--', '--changed', BASE]
const SITE   = ['mise', 'run', 'site:test', '--', '--changed', BASE]

/**
 * Runs the task in `scratch` beside stand-ins for `git` and `mise`, where the
 * merge base is `BASE` and the call `failing` names exits 1.
 */
async function run(
  scratch  : string,
  failing? : string[]
): Promise<{ calls: string[][], status: number | null }> {
  const { invoked, status } = await sync(scratch, 'repo:check', {
    canned : {
      [MERGE.join(' ')]  : { stdout: `${BASE}\n` },
      [PLUGIN.join(' ')] : {},
      [SITE.join(' ')]   : {},
      ...failing && { [failing.join(' ')]: { status: 1 } }
    }
  })

  return { calls: invoked.map((call) => call.args), status }
}

test('runs the type and lint checks of the plugin and the site before its own body', () => {
  const info = execFileSync('mise', ['tasks', 'info', '--json', 'repo:check'], {
    cwd      : join(import.meta.dirname, '..', '..', '..', '..'),
    encoding : 'utf8'
  })

  expect(JSON.parse(info)).toMatchObject({
    aliases : ['check'],
    depends : ['plugin:lint', 'plugin:typecheck', 'site:lint', 'site:typecheck']
  })
})

test(
  'runs the plugin tests and then the site tests Vitest selects against the merge base',
  async ({ scratch }) => {
    expect(await run(scratch)).toEqual({ calls: [MERGE, PLUGIN, SITE], status: 0 })
  }
)

test.for([
  { calls: [MERGE], failing: MERGE, name: '`git merge-base`' },
  { calls: [MERGE, PLUGIN], failing: PLUGIN, name: '`plugin:test`' },
  { calls: [MERGE, PLUGIN, SITE], failing: SITE, name: '`site:test`' }
])('fails and runs nothing further once $name fails', async ({ calls, failing }, { scratch }) => {
  expect(await run(scratch, failing)).toEqual({ calls: calls, status: 1 })
})
