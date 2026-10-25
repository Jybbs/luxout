import { format } from 'node:util'

import type { Logging, PlatformAccessory } from 'homebridge'
import { expect, vi }                      from 'vitest'

import { LuxoutPlatform }         from '../../src/platform/dynamic.js'
import { OUTSIDE, OutsideSensor } from '../../src/sensor/outside.js'
import { Sensor }                 from '../../src/sensor/sensor.js'
import { WindowStore }            from '../../src/weather/store.js'
import { answering }              from '../common/fetch.js'
import * as homebridge            from '../common/homebridge.js'
import { boston, delhi }          from '../common/places.js'
import { thresholdEntry }         from '../common/threshold.js'
import { spaced }                 from '../common/window.js'

const MINUTE = 60_000
const DELHI  = { latitude: delhi.latitude, longitude: delhi.longitude }
const window = spaced(Array(28).fill(400), delhi, '2026-10-11T01:00:00Z')

/**
 * Extends the Homebridge fixtures with a `fetch` that fails every request until
 * a case answers through it, and `start`, which builds a platform on a block
 * that requests through that `fetch` and draws its hourly fetch at 03:00:00,
 * hands it each accessory the cache restored, and fires `didFinishLaunching`.
 * `launch` runs `start` and waits for the first reading the platform logs.
 */
const test = homebridge.test
  .extend('fetch', () => vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed')))
  .extend('start', ({ bridge, fetch, log }) => (block: object, ...accessories: PlatformAccessory[]) => {
    const platform = new LuxoutPlatform(log, { platform: 'Luxout', ...block }, bridge.api, {
      fetch  : fetch,
      random : () => 0
    })

    for (const accessory of accessories) platform.configureAccessory(accessory)

    bridge.emit('didFinishLaunching')
  })
  .extend('launch', ({ log, start }) => async (block: object, ...accessories: PlatformAccessory[]) => {
    start(block, ...accessories)

    await vi.waitUntil(() => vi.mocked(log.debug).mock.lastCall)
  })

test.for([boston, delhi])(
  'registers one accessory named Outside at $latitude, $longitude under one UUID',
  async (block, { bridge, launch }) => {
    await launch(block)

    expect(bridge.registerPlatformAccessories).toHaveBeenCalledExactlyOnceWith(
      'homebridge-luxout',
      'Luxout',
      [expect.objectContaining({ UUID: bridge.hap.uuid.generate('luxout-outside'), displayName: 'Outside' })]
    )
  }
)

test('reads on the accessory it registers', async ({ bridge, launch }) => {
  await launch(delhi)

  const accessory = bridge.registerPlatformAccessories.mock.lastCall?.[2][0]

  expect(accessory && homebridge.level(accessory).value).toBeGreaterThan(0.0001)
})

test(
  'reads on the accessory a restart restores rather than registering another',
  async ({ bridge, launch }) => {
    const accessory = restored(bridge)

    await launch(delhi, accessory)

    expect(bridge.registerPlatformAccessories).not.toHaveBeenCalled()
    expect(bridge.unregisterPlatformAccessories).not.toHaveBeenCalled()
    expect(homebridge.level(accessory).value).toBeGreaterThan(0.0001)
  }
)

test('unregisters a cached accessory the settings no longer describe', async ({ bridge, launch }) => {
  const stale   = bridge.cached(OUTSIDE.name, 'luxout-elsewhere')
  const outside = bridge.cached()

  await launch(delhi, stale, outside)

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
  ({ block, keys }, { bridge, fetch, log, start }) => {
    start(block, bridge.cached(OUTSIDE.name, 'luxout-elsewhere'))
    vi.advanceTimersByTime(MINUTE)

    expect(lines(log)).toEqual([`Outside reads nothing until the settings hold a valid ${keys}`])
    expect(bridge.registerPlatformAccessories).not.toHaveBeenCalled()
    expect(bridge.unregisterPlatformAccessories).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  }
)

test('keeps a cached Outside registered, marked No Response, while the block fails', ({ bridge, start }) => {
  const accessory = restored(bridge)

  start({}, accessory)

  expect(homebridge.level(accessory).statusCode).toBe(homebridge.NO_RESPONSE)
  expect(bridge.unregisterPlatformAccessories).not.toHaveBeenCalled()
})

test(
  'reads the forecast the storage directory holds for the place, requesting none',
  async ({ fetch, launch, log, scratch }) => {
    await new WindowStore(scratch).write(window)
    await launch(delhi)

    expect(vi.mocked(log.debug).mock.lastCall?.[0]).toContain('interpolated between')
    expect(log.warn).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  }
)

test(
  'reads at once from the forecast it fetches at launch where none is stored',
  async ({ fetch, launch, log }) => {
    fetch.mockResolvedValue(Response.json(window))
    await launch(delhi)

    expect(vi.mocked(log.debug).mock.calls[0]?.[0]).toContain('interpolated between')
    expect(log.warn).not.toHaveBeenCalled()
  }
)

test(
  'reads the clear sky alone where the forecast stored is for another place and none arrives',
  async ({ launch, log, scratch }) => {
    await new WindowStore(scratch).write(spaced(Array(28).fill(400), boston, '2026-10-11T01:00:00Z'))
    await launch(delhi)

    expect(vi.mocked(log.debug).mock.lastCall?.[0]).toContain('since no forecast covers the minute')
    expect(vi.mocked(log.warn).mock.calls).toEqual([
      ['Open-Meteo could not be reached'],
      ['Outside reads the clear sky alone until a forecast covers the present']
    ])
  }
)

test(
  'requests through the global fetch where Homebridge builds the platform from its three arguments',
  async ({ bridge, log }) => {
    const fetch = answering(Response.json(window))

    vi.stubGlobal('fetch', fetch)
    new LuxoutPlatform(
      log,
      { latitude: delhi.latitude, longitude: delhi.longitude, platform: 'Luxout' },
      bridge.api
    )
    bridge.emit('didFinishLaunching')
    await vi.waitUntil(() => vi.mocked(log.debug).mock.lastCall)

    expect(fetch).toHaveBeenCalledOnce()
    expect(log.error).not.toHaveBeenCalled()
  }
)

test('leaves no timer running once Homebridge shuts down', async ({ bridge, launch }) => {
  await launch(delhi)
  bridge.emit('shutdown')
  vi.advanceTimersByTime(MINUTE)

  expect(vi.getTimerCount()).toBe(0)
})

test(
  'starts no reading where shutdown comes before the stored forecast is read',
  async ({ bridge, fetch, log, start }) => {
    const read = Promise.withResolvers<undefined>()

    vi.spyOn(WindowStore.prototype, 'read').mockReturnValue(read.promise)
    start(delhi)
    bridge.emit('shutdown')
    read.resolve(undefined)
    await vi.advanceTimersByTimeAsync(MINUTE)

    expect(log.debug).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  }
)

test('logs no line carrying the coordinates', async ({ launch, log }) => {
  await launch(delhi)
  await vi.advanceTimersByTimeAsync(60 * MINUTE)

  expect(lines(log).join('\n')).not.toMatch(/28\.6|77\.2/)
})

test(
  'registers one accessory per threshold entry beside Outside, each named for its entry under its own UUID',
  async ({ bridge, launch }) => {
    const sensors = [OUTSIDE, thresholdEntry({ name: 'Dusk' }), thresholdEntry({ name: 'Glare' })]

    await launch({ ...DELHI, thresholds: [{ name: 'Dusk' }, { name: 'Glare', offLux: 2e4, onLux: 3e4 }] })

    const registered = bridge.registerPlatformAccessories.mock.lastCall?.[2] ?? []

    expect(registered.map(({ UUID, displayName }) => ({ UUID, displayName }))).toEqual(expect.arrayContaining(
      sensors.map(({ name, serial }) => ({ UUID: bridge.hap.uuid.generate(serial), displayName: name }))
    ))
    expect(registered).toHaveLength(sensors.length)
  }
)

test(
  'switches a threshold sensor on the first reading, saving its accessory to the cache',
  async ({ bridge, launch, log }) => {
    await launch({ ...DELHI, thresholds: [{ name: 'Day', offLux: 5000, onLux: 1e4 }] })

    const day = bridge.registerPlatformAccessories.mock.lastCall?.[2]
      .find(({ displayName }) => displayName === 'Day')

    expect(day && homebridge.detection(day).value).toBe(1)
    expect(log.info).toHaveBeenCalledExactlyOnceWith(
      '%s switches %s at a reading of %s lux',
      'Day',
      'on',
      expect.any(String)
    )
    expect(bridge.updatePlatformAccessories).toHaveBeenCalledExactlyOnceWith([day])
  }
)

test(
  'keeps the state a restart restored where the first reading sits inside the gap',
  async ({ bridge, launch, log }) => {
    const accessory = threshold(bridge, 'Haze', 1)

    await launch({ ...DELHI, thresholds: [{ name: 'Haze', offLux: 1e4, onLux: 5e4 }] }, accessory)

    expect(homebridge.detection(accessory).value).toBe(1)
    expect(log.info).not.toHaveBeenCalled()
    expect(bridge.updatePlatformAccessories).not.toHaveBeenCalled()
    expect(bridge.registerPlatformAccessories.mock.lastCall?.[2]).not.toContain(accessory)
  }
)

test.for([
  { names: [],               what: 'removed from the settings' },
  { names: ['Dawn', 'Haze'], what: 'renamed' }
])('unregisters the accessory of an entry $what', async ({ names }, { bridge, launch }) => {
  const accessory = threshold(bridge, 'Dusk', 0)
  const outside   = bridge.cached()

  await launch({ ...DELHI, thresholds: names.map((name) => ({ name })) }, outside, accessory)

  expect(bridge.unregisterPlatformAccessories).toHaveBeenCalledExactlyOnceWith(
    'homebridge-luxout',
    'Luxout',
    [accessory]
  )
})

test('keeps every accessory as it stands where the entries reorder', async ({ bridge, launch }) => {
  const dawn = threshold(bridge, 'Dawn', 0)
  const dusk = threshold(bridge, 'Dusk', 0)

  await launch({ ...DELHI, thresholds: [{ name: 'Dusk' }, { name: 'Dawn' }] }, bridge.cached(), dawn, dusk)

  expect(bridge.registerPlatformAccessories).not.toHaveBeenCalled()
  expect(bridge.unregisterPlatformAccessories).not.toHaveBeenCalled()
})

test(
  'starts no sensor for an entry that fails, logging the one line that names it',
  async ({ bridge, launch, log }) => {
    await launch({ ...DELHI, thresholds: [{ name: 'Dusk', onLux: 0 }, { name: 'Dawn' }] })

    expect(log.warn).toHaveBeenCalledWith('Dusk starts no sensor until its settings hold a valid onLux')
    expect(bridge.registerPlatformAccessories.mock.lastCall?.[2].map(({ displayName }) => displayName))
      .toEqual(expect.arrayContaining(['Dawn', 'Outside']))
    expect(bridge.registerPlatformAccessories.mock.lastCall?.[2]).toHaveLength(2)
  }
)

test(
  'leaves the sensor of the first entry holding a name reading where a later entry repeats it',
  async ({ bridge, launch, log }) => {
    const accessory = threshold(bridge, 'Day', 1)
    const block     = { ...DELHI, thresholds: [{ name: 'Day', offLux: 5000, onLux: 1e4 }, { name: 'Day' }] }

    await launch(block, accessory)

    expect(log.warn).toHaveBeenCalledWith(
      'Day starts no second sensor, since an earlier entry holds its name'
    )
    expect(homebridge.detection(accessory)).toMatchObject({ statusCode: 0, value: 1 })
  }
)

test(
  'compares the first reading against the forecast the launch fetches, not the clear sky alone',
  async ({ bridge, fetch, launch, log }) => {
    fetch.mockResolvedValue(Response.json(spaced(Array(28).fill(200), delhi, '2026-10-11T01:00:00Z')))
    await launch({ ...DELHI, thresholds: [{ name: 'Glare', offLux: 19000, onLux: 20000 }] })

    const glare = bridge.registerPlatformAccessories.mock.lastCall?.[2]
      .find(({ displayName }) => displayName === 'Glare')

    expect(glare && homebridge.detection(glare).value).toBe(0)
    expect(log.info).not.toHaveBeenCalled()
  }
)

test(
  'keeps the cached accessory of an entry that fails registered, marked No Response',
  async ({ bridge, launch }) => {
    const accessory = threshold(bridge, 'Dusk', 1)
    const block     = { ...DELHI, thresholds: [{ name: 'Dusk', offLux: 9, onLux: 9 }] }

    await launch(block, bridge.cached(), accessory)

    expect(homebridge.detection(accessory).statusCode).toBe(homebridge.NO_RESPONSE)
    expect(bridge.unregisterPlatformAccessories).not.toHaveBeenCalled()
  }
)

test(
  'keeps every cached accessory registered, marked No Response, while the block fails',
  ({ bridge, start }) => {
    const outside = restored(bridge)
    const dusk    = threshold(bridge, 'Dusk', 1)

    start({ thresholds: [{ name: 'Dusk' }] }, outside, dusk)

    expect(homebridge.level(outside).statusCode).toBe(homebridge.NO_RESPONSE)
    expect(homebridge.detection(dusk).statusCode).toBe(homebridge.NO_RESPONSE)
    expect(bridge.unregisterPlatformAccessories).not.toHaveBeenCalled()
  }
)

test('logs an error the launch raises', async ({ bridge, log, start }) => {
  const error = new Error('The bridge refused the accessory')

  bridge.registerPlatformAccessories.mockImplementation(() => {
    throw error
  })
  start(delhi)

  await vi.waitFor(() => {
    expect(log.error).toHaveBeenCalledExactlyOnceWith('Outside could not start reading: %s', error)
  })
})

/**
 * Formats every line `log` was handed, through a direct call, `log.log`, or a
 * method named for its level.
 */
function lines(log: Logging): string[] {
  const methods = ['debug', 'error', 'info', 'success', 'warn'] as const
  const calls   = [
    ...vi.mocked(log).mock.calls,
    ...vi.mocked(log.log).mock.calls.map(([, ...call]) => call),
    ...methods.flatMap((method) => vi.mocked(log[method]).mock.calls)
  ]

  return calls.map(([message, ...parameters]) => format(message, ...parameters))
}

/**
 * Builds the accessory of the threshold entry `name` as a restart restores it,
 * its Occupancy Sensor holding `state`.
 */
function threshold(bridge: homebridge.Bridge, name: string, state: number): PlatformAccessory {
  const accessory = bridge.cached(name, thresholdEntry({ name }).serial)

  new Sensor(accessory, bridge.api, 'occupancy')
  homebridge.detection(accessory).updateValue(state)

  return accessory
}

/**
 * Builds the Outside accessory as a restart restores it, its Light Sensor
 * included.
 */
function restored(bridge: homebridge.Bridge): PlatformAccessory {
  const accessory = bridge.cached()

  new OutsideSensor(accessory, bridge.api)

  return accessory
}
