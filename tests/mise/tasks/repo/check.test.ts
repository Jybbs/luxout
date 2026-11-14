/** @module-tag spawns */
import { execFileSync } from 'node:child_process'
import { join }         from 'node:path'

import { expect } from 'vitest'

import { test } from '../../../common/scratch.js'
import { sync } from '../../../common/sync.js'

const PLUGIN = ['mise', 'run', 'plugin:affected']
const SITE   = ['mise', 'run', 'site:affected']

/**
 * Runs the task in `scratch` beside a stand-in for `mise`, where the call
 * `failing` names exits 1.
 */
async function run(
  scratch  : string,
  failing? : string[]
): Promise<{ calls: string[][], status: number | null }> {
  const { invoked, status } = await sync(scratch, 'repo:check', {
    canned : {
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

test('runs the plugin tests and then the site tests a branch reaches', async ({ scratch }) => {
  expect(await run(scratch)).toEqual({ calls: [PLUGIN, SITE], status: 0 })
})

test.for([
  { calls: [PLUGIN], failing: PLUGIN, name: '`plugin:affected`' },
  { calls: [PLUGIN, SITE], failing: SITE, name: '`site:affected`' }
])('fails and runs nothing further once $name fails', async ({ calls, failing }, { scratch }) => {
  expect(await run(scratch, failing)).toEqual({ calls: calls, status: 1 })
})
