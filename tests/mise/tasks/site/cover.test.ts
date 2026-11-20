/** @module-tag spawns */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join }                       from 'node:path'

import { describe } from 'vitest'

import { test } from '../../../common/scratch.js'
import { sync } from '../../../common/sync.js'

const ARGS     = ['--bail', '1']
const CONFIG   = ['vitest', 'run', '--config', '.vitepress/vitest.config.ts', '--coverage']
const COVER    = '../.cache/site/cover'
const PREVIEWS = [
  '.vitepress/tests/lib/readme/readme-dark.test.ts', '.vitepress/tests/lib/readme/readme-light.test.ts'
]
const BLOBS = `${COVER}/blobs`
const MERGE = [...CONFIG, '--merge-reports', BLOBS]

/**
 * A stand-in `vitest` that logs the `COVERAGE_FLOOR` and the arguments of each
 * call, and fails a covered run wherever the other has not started within five
 * seconds of it.
 */
const STAND_IN = [
  '#!/bin/sh',
  'printf \'%s %s\\n\' "${COVERAGE_FLOOR-unset}" "$*" >> "$VITEST_LOG"',
  'case "$*" in *--merge-reports*) exit 0 ;; esac',
  'mkdir -p "$VITEST_LOG.d" && touch "$VITEST_LOG.d/$$"',
  'for _ in $(seq 50); do',
  '  [ "$(ls "$VITEST_LOG.d" | wc -l)" -ge 2 ] && exit 0',
  '  sleep 0.1',
  'done',
  'exit 1',
  ''
].join('\n')

const covered = (name: string, ...args: string[]): string[] => [
  ...CONFIG, '--coverage.reportsDirectory', `${COVER}/${name}`, '--outputFile',
  `${BLOBS}/${name}.json`, '--reporter', 'blob', ...args, ...ARGS
]

const main    = covered('main', ...PREVIEWS.map((file) => `--exclude=${file}`), '--tagsFilter', '!records')
const records = covered('records', ...PREVIEWS)

describe.concurrent('site:cover', () => {
  test.for([
    { failing: [], name: 'passes where every run passes', status: 0 },
    { failing: main, name: 'fails where the run leaving out the recordings fails', status: 1 },
    { failing: records, name: 'fails where the run of the recordings fails', status: 1 },
    { failing: MERGE, name: 'fails where the merge finds the coverage below the floor', status: 1 }
  ])('$name, merging the reports of both runs once both finish', async ({ failing, status }, {
    expect,
    scratch
  }) => {
    const run = await sync(scratch, 'site:cover', {
      args   : ARGS,
      canned : Object.fromEntries([main, records, MERGE].map((call) =>
        [call.join(' '), { status: call === failing ? 1 : 0 }]
      ))
    })

    expect(run.status).toBe(status)
    expect(new Set(run.commands.slice(0, 2))).toEqual(new Set([main, records]))
    expect(run.commands.slice(2)).toEqual([MERGE])
  })

  test('starts both runs together under no floor, then merges under the floor', async ({
    expect,
    scratch
  }) => {
    const log = join(scratch, 'vitest.log')

    await mkdir(join(scratch, 'bin'), { recursive: true })
    await writeFile(join(scratch, 'bin', 'vitest'), STAND_IN, { mode: 0o755 })

    const { status } = await sync(scratch, 'site:cover', {
      args : ARGS,
      env  : { COVERAGE_FLOOR: '95', VITEST_LOG: log }
    })

    const lines = (await readFile(log, 'utf8')).split('\n').slice(0, -1)

    expect({ merge: lines.slice(2), runs: new Set(lines.slice(0, 2)), status }).toEqual({
      merge  : [`95 ${MERGE.slice(1).join(' ')}`],
      runs   : new Set([`0 ${main.slice(1).join(' ')}`, `0 ${records.slice(1).join(' ')}`]),
      status : 0
    })
  })
})
