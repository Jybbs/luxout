import { spawnSync } from 'node:child_process'
import { readFile }  from 'node:fs/promises'
import { join }      from 'node:path'

import { expect } from 'vitest'

import { test } from '../../../common/scratch.js'

const TASK = join(import.meta.dirname, '..', '..', '..', '..', '.mise', 'tasks', 'gha', 'brief')

async function brief(needs: Record<string, { result: string }>, scratch: string) {
  const summary = join(scratch, 'summary.md')

  const { status } = spawnSync(TASK, {
    encoding : 'utf8',
    env      : { ...process.env, GITHUB_STEP_SUMMARY: summary, NEEDS: JSON.stringify(needs) }
  })

  return { status, summary: await readFile(summary, 'utf8') }
}

test('writes a row naming each job and its result, and passes where none failed', async ({ scratch }) => {
  expect(await brief({ check: { result: 'success' }, press: { result: 'skipped' } }, scratch)).toEqual({
    status  : 0,
    summary : '| **Job** | **Result** |\n|---|---|\n| `check` | success |\n| `press` | skipped |\n'
  })
})

test.for(['failure', 'cancelled'])('fails where a job reports %s', async (result, { scratch }) => {
  const { status } = await brief({ check: { result: 'success' }, press: { result } }, scratch)

  expect(status).toBe(1)
})
