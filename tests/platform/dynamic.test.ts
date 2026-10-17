import { mkdir }  from 'node:fs/promises'
import { join }   from 'node:path'
import { format } from 'node:util'

import type { Logging, PlatformAccessory } from 'homebridge'
import { expect, vi }                      from 'vitest'

import { LuxoutPlatform }           from '../../src/platform/dynamic.js'
import { OUTSIDE, OutsideSensor }   from '../../src/sensor/outside.js'
import { WindowStore }              from '../../src/weather/store.js'
import { type Bridge, level, test } from '../common/homebridge.js'
import { boston, delhi }            from '../common/places.js'
import { spaced }                   from '../common/window.js'

const MINUTE = 60_000
const window = spaced(Array(28).fill(400), delhi, '2026-10-11T01:00:00Z')

test.for([boston, delhi])(
  'registers one accessory named Outside at $latitude, $longitude under one UUID',
  async (block, { bridge, log }) => {
    await launch(bridge, log, block)

    expect(bridge.registerPlatformAccessories).toHaveBeenCalledExactlyOnceWith(
      'homebridge-luxout',
      'Luxout',
      [expect.objectContaining({ UUID: bridge.hap.uuid.generate('luxout-outside'), displayName: 'Outside' })]
    )
  }
)

test('reads on the accessory a restart restores rather than registering another', async ({ bridge, log }) => {
  const accessory = restored(bridge)

  await launch(bridge, log, boston, accessory)

  expect(bridge.registerPlatformAccessories).not.toHaveBeenCalled()
  expect(bridge.unregisterPlatformAccessories).not.toHaveBeenCalled()
  expect(level(accessory).value).toBe(0.0001)
})

test('unregisters a cached accessory the settings no longer describe', async ({ bridge, log }) => {
  const stale   = bridge.cached(OUTSIDE.name, 'luxout-elsewhere')
  const outside = bridge.cached()

  await launch(bridge, log, delhi, stale, outside)

  expect(bridge.unregisterPlatformAccessories).toHaveBeenCalledExactlyOnceWith(
    'homebridge-luxout',
    'Luxout',
    [stale]
  )
  expect(bridge.registerPlatformAccessories).not.toHaveBeenCalled()
})

test.for([
  { block: {},                                                keys: 'latitude and longitude' },
  { block: { latitude: 91, longitude: delhi.longitude },      keys: 'latitude' },
  { block: { latitude: delhi.latitude, longitude: '77.21' }, keys: 'longitude' }
])(
  'starts nothing for a block lacking a valid $keys, logging the one line that names it',
  ({ block, keys }, { bridge, log }) => {
    start(bridge, log, block, bridge.cached(OUTSIDE.name, 'luxout-elsewhere'))
    vi.advanceTimersByTime(MINUTE)

    expect(lines(log)).toEqual([`Outside reads nothing until the settings hold a valid ${keys}`])
    expect(bridge.registerPlatformAccessories).not.toHaveBeenCalled()
    expect(bridge.unregisterPlatformAccessories).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  }
)

test('keeps a cached Outside registered, marked No Response, while the block fails', ({ bridge, log }) => {
  const accessory = restored(bridge)
  const update    = vi.spyOn(level(accessory), 'updateValue')

  start(bridge, log, {}, accessory)

  expect(update).toHaveBeenCalledExactlyOnceWith(expect.any(Error))
  expect(bridge.unregisterPlatformAccessories).not.toHaveBeenCalled()
})

test('reads the forecast the storage directory holds for the place', async ({ bridge, log, scratch }) => {
  await new WindowStore(scratch).write(window)
  await launch(bridge, log, delhi)

  expect(vi.mocked(log.debug).mock.lastCall?.[0]).toContain('interpolated between')
  expect(log.warn).not.toHaveBeenCalled()
})

test('ignores a forecast stored for another place', async ({ bridge, log, scratch }) => {
  await new WindowStore(scratch).write(spaced(Array(28).fill(400), boston, '2026-10-11T01:00:00Z'))
  await launch(bridge, log, delhi)

  expect(vi.mocked(log.debug).mock.lastCall?.[0]).toContain('with no forecast covering the minute')
  expect(log.warn).toHaveBeenCalledExactlyOnceWith(
    'Outside reads the clear sky alone until a forecast covers the present'
  )
})

test('reads the clear sky alone where no stored forecast can be read', async ({ bridge, log, scratch }) => {
  await mkdir(join(scratch, 'luxout-forecast.json'))
  await launch(bridge, log, delhi)

  expect(log.warn).toHaveBeenCalledWith(
    'Outside reads no stored forecast, since reading it failed: %s',
    expect.objectContaining({ code: 'EISDIR' })
  )
  expect(log.debug).toHaveBeenCalledOnce()
})

test('leaves no timer running once Homebridge shuts down', async ({ bridge, log }) => {
  await launch(bridge, log, delhi)
  bridge.emit('shutdown')
  vi.advanceTimersByTime(MINUTE)

  expect(vi.getTimerCount()).toBe(0)
})

test('starts no reading where shutdown comes before the stored forecast is read', async ({ bridge, log }) => {
  const read = Promise.withResolvers<undefined>()

  vi.spyOn(WindowStore.prototype, 'read').mockReturnValue(read.promise)
  start(bridge, log, delhi)
  bridge.emit('shutdown')
  read.resolve(undefined)
  await vi.advanceTimersByTimeAsync(MINUTE)

  expect(log.debug).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

test('logs no line carrying the coordinates', async ({ bridge, log, scratch }) => {
  await new WindowStore(scratch).write(window)
  await launch(bridge, log, delhi)
  await vi.advanceTimersByTimeAsync(10 * MINUTE)

  expect(lines(log).join('\n')).not.toMatch(/28\.6|77\.2/)
})

test('logs an error the launch raises', async ({ bridge, log }) => {
  const error = new Error('The bridge refused the accessory')

  bridge.registerPlatformAccessories.mockImplementation(() => {
    throw error
  })
  start(bridge, log, delhi)

  await vi.waitFor(() => {
    expect(log.error).toHaveBeenCalledExactlyOnceWith('Outside could not start reading: %s', error)
  })
})

/**
 * Starts a platform on `block` as `start` does and waits for its first reading.
 */
async function launch(
  bridge         : Bridge,
  log            : Logging,
  block          : object,
  ...accessories : PlatformAccessory[]
): Promise<void> {
  start(bridge, log, block, ...accessories)

  await vi.waitFor(() => expect(log.debug).toHaveBeenCalled())
}

/**
 * Formats every line `log` was handed, at every level.
 */
function lines(log: Logging): string[] {
  return (['debug', 'error', 'info', 'success', 'warn'] as const).flatMap((method) => {
    return vi.mocked(log[method]).mock.calls.map(([message, ...parameters]) => format(message, ...parameters))
  })
}

/**
 * Builds the Outside accessory as a restart restores it, its Light Sensor
 * included.
 */
function restored(bridge: Bridge): PlatformAccessory {
  const accessory = bridge.cached()

  new OutsideSensor(accessory, bridge.api)

  return accessory
}

/**
 * Builds a platform on `block`, hands it each accessory the cache restored, and
 * fires `didFinishLaunching`.
 */
function start(bridge: Bridge, log: Logging, block: object, ...accessories: PlatformAccessory[]): void {
  const platform = new LuxoutPlatform(log, { platform: 'Luxout', ...block }, bridge.api)

  for (const accessory of accessories) platform.configureAccessory(accessory)

  bridge.emit('didFinishLaunching')
}
