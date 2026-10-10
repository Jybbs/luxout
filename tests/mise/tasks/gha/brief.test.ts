import { spawnSync } from 'node:child_process'
import { readFile }  from 'node:fs/promises'
import { join }      from 'node:path'

import { expect } from 'vitest'

import { test } from '../../../common/scratch.js'

interface Need {
  outputs : Record<string, string>
  result  : string
}

const task = join(import.meta.dirname, '..', '..', '..', '..', '.mise', 'tasks', 'gha', 'brief')

async function brief(needs: Record<string, Need>, scratch: string) {
  const summary = join(scratch, 'summary.md')

  const { status } = spawnSync(task, {
    encoding : 'utf8',
    env      : { ...process.env, GITHUB_STEP_SUMMARY: summary, NEEDS: JSON.stringify(needs) }
  })

  return { status, summary: await readFile(summary, 'utf8') }
}

const need = (result: string, outputs: Record<string, string> = {}) => ({ outputs, result })

test('writes a row naming each job and its result, and passes where none failed', async ({ scratch }) => {
  expect(await brief({ check: need('success'), press: need('skipped') }, scratch)).toEqual({
    status  : 0,
    summary : '| **Job** | **Result** |\n|---|---|\n| `check` | success |\n| `press` | skipped |\n'
  })
})

test('lists each output beneath the results, leaving out an empty one', async ({ scratch }) => {
  const outputs = { state: 'created', url: 'https://github.com/Jybbs/luxout/releases', version: '' }

  expect(await brief({ draft: need('success', outputs), pack: need('success') }, scratch)).toEqual({
    status  : 0,
    summary : '| **Job** | **Result** |\n|---|---|\n| `draft` | success |\n| `pack` | success |\n\n'
            + '| **Output** | **Value** |\n|---|---|\n| `draft.state` | created |\n'
            + '| `draft.url` | https://github.com/Jybbs/luxout/releases |\n'
  })
})

test.for(['failure', 'cancelled'])('fails where a job reports %s', async (result, { scratch }) => {
  expect((await brief({ check: need('success'), press: need(result) }, scratch)).status).toBe(1)
})
