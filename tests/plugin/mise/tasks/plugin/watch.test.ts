/** @module-tag spawns */
import { describe } from 'vitest'

import { test } from '../../../common/scratch.js'
import { sync } from '../../../common/sync.js'

const WATCH = ['mise', 'watch', '--restart', 'plugin:run', '-T', 'holds a space']

describe.concurrent('plugin:watch', () => {
  test('hands plugin:run and every further argument to mise watch, restarting it on each change', async ({
    expect,
    scratch
  }) => {
    expect(await sync(scratch, 'plugin:watch', {
      args   : WATCH.slice(4),
      canned : { [WATCH.join(' ')]: {} }
    })).toMatchObject({ commands: [WATCH], status: 0 })
  })
})
