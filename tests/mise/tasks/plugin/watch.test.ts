import { expect } from 'vitest'

import { test } from '../../../common/scratch.js'
import { sync } from '../../../common/sync.js'

const WATCH = ['mise', 'watch', '--restart', 'plugin:run', '-T', 'holds a space']

test('hands plugin:run and every further argument to mise watch, restarting it on each change', async ({
  scratch
}) => {
  const { invoked, status } = await sync(scratch, 'plugin:watch', {
    args   : WATCH.slice(4),
    canned : { [WATCH.join(' ')]: {} }
  })

  expect({ calls: invoked.map((call) => call.args), status }).toEqual({ calls: [WATCH], status: 0 })
})
