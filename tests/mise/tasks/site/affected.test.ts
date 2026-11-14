/** @module-tag spawns */
import { expect } from 'vitest'

import { test } from '../../../common/scratch.js'
import { sync } from '../../../common/sync.js'

const ARGS  = ['--bail', '1']
const BASE  = '5cb3ee2'
const MERGE = ['git', 'merge-base', 'origin/main', 'HEAD']
const SITE  = ['mise', 'run', 'site:test', '--', '--changed', BASE, ...ARGS]

/**
 * Runs the task in `scratch` beside stand-ins for `git` and `mise`, where the
 * merge base is `BASE` and the call `failing` names exits 1.
 */
async function run(
  scratch  : string,
  failing? : string[]
): Promise<{ calls: string[][], status: number | null }> {
  const { invoked, status } = await sync(scratch, 'site:affected', {
    args   : ARGS,
    canned : {
      [MERGE.join(' ')] : { stdout: `${BASE}\n` },
      [SITE.join(' ')]  : {},
      ...failing && { [failing.join(' ')]: { status: 1 } }
    }
  })

  return { calls: invoked.map((call) => call.args), status }
}

test(
  'runs site:test against the merge base, passing every further argument to Vitest',
  async ({ scratch }) => {
    expect(await run(scratch)).toEqual({ calls: [MERGE, SITE], status: 0 })
  }
)

test.for([
  { calls: [MERGE], failing: MERGE, name: '`git merge-base`' },
  { calls: [MERGE, SITE], failing: SITE, name: '`site:test`' }
])('fails once $name fails', async ({ calls, failing }, { scratch }) => {
  expect(await run(scratch, failing)).toEqual({ calls: calls, status: 1 })
})
