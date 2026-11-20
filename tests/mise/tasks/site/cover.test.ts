/** @module-tag spawns */
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
})
