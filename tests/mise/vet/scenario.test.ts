import { join } from 'node:path'

import { expect, it, vi } from 'vitest'

import type { Block }                        from '../../../.mise/vet/homebridge.ts'
import { Scenario, Shutdown, checks }        from '../../../.mise/vet/scenario.ts'
import schema                               from '../../../config.schema.json' with { type: 'json' }
import { test }                             from '../../common/scratch.js'
import { type Acts, TUNING, install, stage } from '../../common/vet.js'

const BLOCK = { platform: 'Luxout' }

/**
 * Runs `check` against the stand-in Homebridge installed under `scratch`,
 * acting as `acts` asks.
 */
async function verdict(check: Scenario | Shutdown, scratch: string, acts?: Acts, tuning = TUNING) {
  const homebridge = await install(join(scratch, 'release'))

  return check.run(homebridge, await stage(scratch, acts), tuning)
}

it('builds each run the checks start from the schema, running a repeated block once', () => {
  const block = { latitude: -90, longitude: -180, name: 'test-value', platform: 'Luxout' }

  expect(checks(schema).map(({ block, name }) => ({ block, name }))).toEqual([
    { block: undefined, name: 'no config' },
    { block: BLOCK, name: 'platform only' },
    { block: block, name: 'full config' },
    { block: block, name: 'network resilience' },
    { block: block, name: 'shutdown and restart' }
  ])
})

it('runs the minimal block where it differs from the platform alone', () => {
  const plugin = { pluginAlias: 'Luxout', schema: { ...schema.schema, required: ['latitude'] } }

  expect(checks(plugin).find(({ name }) => name === 'minimal required')?.block)
    .toEqual({ latitude: -90, platform: 'Luxout' })
})

it('fails every host name lookup in the network resilience run alone', () => {
  const offline = checks(schema).filter((check) => check instanceof Scenario && check.offline)

  expect(offline.map(({ name }) => name)).toEqual(['network resilience'])
})

test.concurrent('passes a block that listens, initializes, and exits in time', async ({
  expect,
  scratch
}) => {
  expect((await verdict(new Scenario('Luxout', 'full config', BLOCK), scratch)).failures).toEqual([])
})

test.concurrent('passes no block while the platform never initializes', async ({ expect, scratch }) => {
  expect((await verdict(new Scenario('Luxout', 'no config'), scratch)).failures).toEqual([])
})

test.concurrent.for<{ acts: Acts, block?: Block, failure: string }>([
  { acts: { mute: true }, block: BLOCK, failure: 'never reports its bridge listening' },
  { acts: { exits: true }, block: BLOCK, failure: 'exits before it is stopped' },
  { acts: { silent: true }, block: BLOCK, failure: 'never initializes the Luxout platform' },
  { acts: { initializes: true }, failure: 'initializes the Luxout platform with no block' },
  { acts: { logs: 'ReferenceError: x is not defined' }, block: BLOCK, failure: 'logs ReferenceError' }
])('fails a run that $failure', async ({ acts, block, failure }, { expect, scratch }) => {
  expect((await verdict(new Scenario('Luxout', 'run', block), scratch, acts)).failures).toEqual([failure])
})

test.concurrent('fails a run that writes outside its storage', async ({ expect, scratch }) => {
  const outside = join(scratch, 'outside.json')

  expect((await verdict(new Scenario('Luxout', 'run', BLOCK), scratch, { writes: outside })).failures)
    .toEqual([`writes ${outside} outside the storage directory`])
})

test.concurrent('fails a run that outlasts the grace after SIGTERM', async ({ expect, scratch }) => {
  const { failures } = await verdict(new Scenario('Luxout', 'run', BLOCK), scratch, { lingers: true }, {
    ...TUNING,
    grace: 500
  })

  expect(failures).toEqual(['takes longer than 0.5 seconds to exit after SIGTERM'])
})

test.concurrent('keeps a run up whose requests all fail as ENOTFOUND', async ({ expect, scratch }) => {
  const scenario = new Scenario('Luxout', 'network resilience', BLOCK, true)
  const run      = await verdict(scenario, scratch, { fetches: 'https://api.open-meteo.com/v1/forecast' })

  expect(run).toEqual({ failures: [], output: expect.stringContaining('Fetch failed: ENOTFOUND\n') })
})

test.concurrent('passes a run that exits in time and starts again on its port', async ({
  expect,
  scratch
}) => {
  expect((await verdict(new Shutdown(BLOCK), scratch)).failures).toEqual([])
})

test.concurrent('fails a second start that meets EADDRINUSE', async ({ expect, scratch }) => {
  const homebridge = await install(join(scratch, 'release'))
  const launch     = await stage(scratch, { conflicts: true })

  expect((await new Shutdown(BLOCK).run(homebridge, launch, TUNING)).failures)
    .toEqual([`meets EADDRINUSE starting again on port ${launch.port}`])
})

test.concurrent('stops at a first start that never listens', async ({ expect, scratch }) => {
  const homebridge   = await install(join(scratch, 'release'))
  const start        = vi.spyOn(homebridge, 'start')
  const { failures } = await new Shutdown(BLOCK).run(homebridge, await stage(scratch, { mute: true }), {
    ...TUNING,
    observe: 300
  })

  expect({ failures, starts: start.mock.calls.length }).toEqual({
    failures : ['never reports its bridge listening'],
    starts   : 1
  })
})

test.concurrent('fails each start that outlasts the grace after SIGTERM', async ({ expect, scratch }) => {
  const { failures } = await verdict(new Shutdown(BLOCK), scratch, { lingers: true }, {
    ...TUNING,
    grace: 500
  })

  expect(failures).toEqual(Array(2).fill('takes longer than 0.5 seconds to exit after SIGTERM'))
})
