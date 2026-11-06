import { readdir }        from 'node:fs/promises'
import { join, relative } from 'node:path'

import getPort        from 'get-port'
import { expect, vi } from 'vitest'

import { Homebridge }      from '../../../.mise/vet/homebridge.ts'
import type * as scenario  from '../../../.mise/vet/scenario.ts'
import { Vet }             from '../../../.mise/vet/vet.ts'
import schema              from '../../../config.schema.json' with { type: 'json' }
import { plant, test }     from '../../common/scratch.js'
import { TUNING, install } from '../../common/vet.js'

vi.mock(import('get-port'), async (original) => {
  const actual = await original()

  return { ...actual, default: vi.fn<typeof actual.default>(actual.default) }
})

/**
 * Stands in for a check, answering every run with `failures` and recording the
 * stage each run was handed.
 */
function check(name: string, failures: string[] = []) {
  const stages: scenario.Stage[] = []
  const run                      = vi.fn<scenario.Check['run']>(async (_, stage) => {
    stages.push(stage)

    return { failures, output: `${name} output` }
  })

  return { block: undefined, name, run, stages }
}

test('prints a passing line for each check under each release and exits 0', async ({ scratch }) => {
  const write    = vi.fn<(line: string) => void>()
  const checks   = [check('no config'), check('full config')]
  const releases = [
    new Homebridge(join(scratch, 'floor'), '1.8.5'),
    new Homebridge(join(scratch, 'pinned'), '2.4.0')
  ]
  const status   = await new Vet(checks, releases, scratch, TUNING, write).run()

  expect({ lines: write.mock.calls.flat(), status }).toEqual({
    lines  : [
      'Homebridge 1.8.5, no config: passes',
      'Homebridge 1.8.5, full config: passes',
      'Homebridge 2.4.0, no config: passes',
      'Homebridge 2.4.0, full config: passes'
    ],
    status : 0
  })
})

test('prints each failure and the output of a failing check and exits 1', async ({ scratch }) => {
  const write    = vi.fn<(line: string) => void>()
  const failing  = check('full config', ['logs TypeError', 'never initializes the Luxout platform'])
  const releases = [new Homebridge(join(scratch, 'pinned'), '2.4.0')]

  expect(await new Vet([check('no config'), failing], releases, scratch, TUNING, write).run()).toBe(1)
  expect(write.mock.calls.flat()).toEqual([
    'Homebridge 2.4.0, no config: passes',
    'Homebridge 2.4.0, full config: fails, since it logs TypeError '
  + 'and never initializes the Luxout platform\nfull config output'
  ])
})

test('hands each run an empty storage directory under .cache/vet and a port no other run holds', async ({
  scratch
}) => {
  const checks   = [check('no config'), check('full config')]
  const releases = [
    new Homebridge(join(scratch, 'floor'), '1.8.5'),
    new Homebridge(join(scratch, 'pinned'), '2.4.0')
  ]

  await plant(scratch, { '.cache/vet/pinned/no-config/stale.json': '' })
  await new Vet(checks, releases, scratch, TUNING, vi.fn<(line: string) => void>()).run()

  const stages = checks.flatMap(({ stages }) => stages)

  expect({
    aborted  : stages.map(({ signal }) => signal.aborted),
    ports    : new Set(stages.map(({ port }) => port)).size,
    stale    : await readdir(join(scratch, '.cache', 'vet', 'pinned', 'no-config')),
    storages : stages.map(({ storage }) => relative(scratch, storage)).toSorted()
  }).toEqual({
    aborted  : [true, true, true, true],
    ports    : 4,
    stale    : [],
    storages : [
      '.cache/vet/floor/full-config',
      '.cache/vet/floor/no-config',
      '.cache/vet/pinned/full-config',
      '.cache/vet/pinned/no-config'
    ]
  })
})

test('holds each run to the checks’ 30-second window and 12-second grace by default', async ({
  scratch
}) => {
  const stub  = check('no config')
  const write = vi.fn<(line: string) => void>()

  await new Vet([stub], [new Homebridge(scratch, '2.4.0')], scratch, undefined, write).run()

  expect(stub.run.mock.calls[0]?.[2]).toEqual({ grace: 12_000, observe: 30_000, settle: 1_500 })
})

test('draws each port clear of Homebridge’s sample bridge port and the Homebridge UI’s default port', async ({
  scratch
}) => {
  const write = vi.fn<(line: string) => void>()

  await new Vet([check('no config')], [new Homebridge(scratch, '2.4.0')], scratch, TUNING, write).run()

  expect(getPort).toHaveBeenCalledWith({ exclude: [51826, 8581], reserve: true })
})

test('reads the schema and each release from directories resolved against the root', async ({ scratch }) => {
  const write = vi.fn<(line: string) => void>()

  await plant(scratch, { 'config.schema.json': JSON.stringify(schema) })
  await install(join(scratch, 'releases', 'pinned'), '2.4.0')
  await plant(scratch, { 'releases/pinned/node_modules/.bin/homebridge': 'process.exit(3)\n' })

  const vet    = await Vet.read(['releases/pinned'], scratch, TUNING, write)
  const status = await vet.run()

  expect({ lines: write.mock.calls.flat().map((line) => line.split(':')[0]), status }).toEqual({
    lines  : [
      'Homebridge 2.4.0, no config',
      'Homebridge 2.4.0, platform only',
      'Homebridge 2.4.0, full config',
      'Homebridge 2.4.0, network resilience',
      'Homebridge 2.4.0, shutdown and restart'
    ],
    status : 1
  })
})
