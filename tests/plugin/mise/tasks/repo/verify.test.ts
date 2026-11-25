/** @module-tag spawns */
import { cp, readFile } from 'node:fs/promises'
import { join }         from 'node:path'

import { describe } from 'vitest'

import { root }        from '../../../common/paths.js'
import { plant, test } from '../../../common/scratch.js'
import { info, mised } from '../../../common/sync.js'

interface Listed {
  run: [{ tasks: string[] }]
}

const FILE = join('.mise', 'tasks', 'repo', 'verify.toml')
const LAST = /\nThese checks failed: plugin:lint, site:typecheck\n\[repo:verify\] ERROR task failed\n$/

const { run: [{ tasks: CHECKS }] } = await info('repo:verify:checks') as Listed

/**
 * Runs `mise ci` in `scratch`, a checkout holding `verify.toml` beside a
 * stand-in for each check it lists, which logs its name to `ran.log` and exits
 * 1 where `failing` names it, under the readiness check `doctor` runs, one
 * task at a time so a run stopping at its first failure starts no later check.
 */
async function ci(scratch: string, failing: string[], doctor = 'true') {
  const stand = (check: string): string =>
    `[tasks."${check}"]\nrun = "echo ${check} >> ran.log${failing.includes(check) ? ' && exit 1' : ''}"\n`

  await plant(scratch, {
    '.mise/config.toml' : `[doctor.checks.ready]\nrun = "${doctor}"\n\n${CHECKS.map(stand).join('\n')}`,
    'ran.log'           : ''
  })
  await cp(join(root, FILE), join(scratch, FILE))

  const run = await mised(scratch, ['run', 'ci'], { MISE_JOBS: '1' })
  const ran = (await readFile(join(scratch, 'ran.log'), 'utf8')).split('\n').filter(Boolean).toSorted()

  return { ...run, ran }
}

describe.concurrent('repo:verify', () => {
  test('runs every check and passes where each passes', async ({ expect, scratch }) => {
    expect(await ci(scratch, [])).toMatchObject({ ran: CHECKS.toSorted(), status: 0 })
  })

  test('carries every check to its end past two that fail and finishes on both', async ({
    expect,
    scratch
  }) => {
    const failing = ['plugin:lint', 'site:typecheck']

    expect(await ci(scratch, failing)).toMatchObject({
      ran    : CHECKS.toSorted(),
      status : 1,
      stderr : expect.stringMatching(LAST)
    })
  })

  test('runs no check where a readiness check fails', async ({ expect, scratch }) => {
    expect(await ci(scratch, [], 'false')).toMatchObject({ ran: [], status: 1 })
  })
})
