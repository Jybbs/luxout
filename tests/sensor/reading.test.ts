import type { Logging, PlatformAccessory } from 'homebridge'
import { expect, vi }                      from 'vitest'

import type { Place }                          from '../../src/config/place.js'
import { ClearSky }                            from '../../src/daylight/clear-sky.js'
import { Estimator }                           from '../../src/daylight/estimator.js'
import { Sun }                                 from '../../src/daylight/sun.js'
import { OutsideSensor }                       from '../../src/sensor/outside.js'
import { Reading }                             from '../../src/sensor/reading.js'
import { ThresholdSensor }                     from '../../src/sensor/threshold.js'
import { type Bridge, detection, level, test } from '../common/homebridge.js'
import { angeles, boston, delhi }              from '../common/places.js'
import { thresholdEntry }                      from '../common/threshold.js'
import { spaced }                              from '../common/window.js'

const MINUTE = 60_000

test('shows a reading at start and one each minute after it', ({ bridge, log }) => {
  const { accessory, reading } = meter(bridge, log, delhi)
  const shown: unknown[]       = []

  level(accessory).on('change', ({ newValue }) => shown.push(newValue))
  reading.start(new AbortController().signal)
  vi.advanceTimersByTime(3 * MINUTE)

  expect(shown).toHaveLength(4)
})

test('reads again at the start of the next minute', ({ bridge, log }) => {
  meter(bridge, log, delhi).reading.start(new AbortController().signal)
  vi.advanceTimersByTime(29_999)

  expect(log.debug).toHaveBeenCalledOnce()

  vi.advanceTimersByTime(1)

  expect(log.debug).toHaveBeenCalledTimes(2)
})

test(
  'reads each minute through the hour a fall-back repeats on a host in America/New_York',
  ({ bridge, log }) => {
    vi.stubEnv('TZ', 'America/New_York')
    vi.setSystemTime(new Date('2026-11-01T05:58:30Z'))
    meter(bridge, log, delhi).reading.start(new AbortController().signal)
    vi.advanceTimersByTime(3 * MINUTE)

    expect(log.debug).toHaveBeenCalledTimes(4)
  }
)

test('stops reading once its signal aborts, leaving no timer behind', ({ bridge, log }) => {
  const shutdown = new AbortController()

  meter(bridge, log, delhi).reading.start(shutdown.signal)
  shutdown.abort()
  vi.advanceTimersByTime(MINUTE)

  expect(log.debug).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})

test('reads nothing from a signal that has already aborted', ({ bridge, log }) => {
  meter(bridge, log, delhi).reading.start(AbortSignal.abort())
  vi.advanceTimersByTime(MINUTE)

  expect(log.debug).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

test('logs the altitude, the clear sky, the factor, and both steps behind a reading', ({ bridge, log }) => {
  const { reading } = meter(bridge, log, delhi)

  reading.use(spaced(Array(28).fill(200), delhi, '2026-10-11T01:00:00Z'))
  reading.start(new AbortController().signal)

  expect(vi.mocked(log.debug).mock.calls).toMatchInlineSnapshot(`
    [
      [
        "Outside reads %s lux from a solar altitude of %s°, a clear-sky illuminance of %s lux, and a cloud factor of %s interpolated between %s at %s and %s at %s",
        "18380",
        "15.87",
        "22190",
        "0.8286",
        "0.9243",
        "2026-10-11T02:00:00.000Z",
        "0.7328",
        "2026-10-11T02:15:00.000Z",
      ],
    ]
  `)
})

test(
  'logs the altitude, the clear sky, and a factor of 1 behind a reading no forecast covers',
  ({ bridge, log }) => {
    meter(bridge, log, delhi).reading.start(new AbortController().signal)

    expect(vi.mocked(log.debug).mock.calls).toMatchInlineSnapshot(`
      [
        [
          "Outside reads %s lux from a solar altitude of %s°, a clear-sky illuminance of %s lux, and a cloud factor of %s, since no forecast covers the minute",
          "22190",
          "15.87",
          "22190",
          "1",
        ],
      ]
    `)
  }
)

test('logs the clamped reading and a clear sky of 0 lux under a night sun', ({ bridge, log }) => {
  meter(bridge, log, boston).reading.start(new AbortController().signal)

  expect(vi.mocked(log.debug).mock.calls).toMatchInlineSnapshot(`
    [
      [
        "Outside reads %s lux from a solar altitude of %s°, a clear-sky illuminance of %s lux, and a cloud factor of %s, since no forecast covers the minute",
        "0.0001",
        "-42.54",
        "0",
        "1",
      ],
    ]
  `)
})

test('warns once as the reading falls back to the clear sky, for minutes on end', ({ bridge, log }) => {
  meter(bridge, log, delhi).reading.start(new AbortController().signal)
  vi.advanceTimersByTime(5 * MINUTE)

  expect(log.warn).toHaveBeenCalledExactlyOnceWith(
    'Outside reads the clear sky alone until a forecast covers the present'
  )
})

test('warns again once a forecast that covered a reading runs out', ({ bridge, log }) => {
  const { reading } = meter(bridge, log, delhi)

  reading.start(new AbortController().signal)
  reading.use(spaced([400, 400], delhi, '2026-10-11T02:00:00Z'))
  vi.advanceTimersByTime(MINUTE)

  expect(log.warn).toHaveBeenCalledOnce()

  vi.advanceTimersByTime(8 * MINUTE)

  expect(log.warn).toHaveBeenCalledTimes(2)
})

test('keeps a twilight factor across a window replacing the one before it', ({ bridge, log }) => {
  const evening   = spaced(Array(28).fill(20), angeles, '2026-10-10T23:00:00Z')
  const night     = spaced(Array(28).fill(0), angeles, '2026-10-11T01:00:00Z')
  const replaced  = meter(bridge, log, angeles)
  const kept      = meter(bridge, log, angeles)
  const unrelated = meter(bridge, log, angeles)

  replaced.reading.use(evening)
  replaced.reading.use(night)
  kept.reading.use(evening)
  unrelated.reading.use(night)

  for (const { reading } of [replaced, kept, unrelated]) reading.start(new AbortController().signal)

  expect(level(replaced.accessory).value).toBe(level(kept.accessory).value)
  expect(level(replaced.accessory).value).toBeLessThan(Number(level(unrelated.accessory).value))
})

test('switches each threshold sensor on the clamped reading Outside shows', ({ bridge, log }) => {
  const floor     = thresholdEntry({ name: 'Floor', offLux: 1, onLux: 0.0001 })
  const dark      = thresholdEntry({ name: 'Dark' })
  const cached = [floor, dark].map((entry) => ({ accessory: bridge.cached(entry.name, entry.serial), entry }))
  const estimator = new Estimator(new ClearSky(), new Sun(boston))
  const sensors   = cached.map(({ accessory, entry }) =>
    new ThresholdSensor(accessory, bridge.api, entry, log)
  )

  new Reading(estimator, log, new OutsideSensor(bridge.cached(), bridge.api), sensors)
    .start(new AbortController().signal)

  expect(cached.map(({ accessory }) => detection(accessory).value)).toEqual([1, 1])
  expect(vi.mocked(log.info).mock.calls).toEqual([
    ['%s switches %s at a reading of %s lux', 'Floor', 'on', '0.0001'],
    ['%s switches %s at a reading of %s lux', 'Dark', 'on', '0.0001']
  ])
})

test('logs an error a reading raises and reads again the next minute', ({ bridge, log }) => {
  const error = new Error('The sun is nowhere')

  vi.spyOn(Estimator.prototype, 'estimate').mockImplementationOnce(() => {
    throw error
  })
  meter(bridge, log, delhi).reading.start(new AbortController().signal)
  vi.advanceTimersByTime(MINUTE)

  expect(log.error).toHaveBeenCalledExactlyOnceWith('Outside could not read the light outdoors: %s', error)
  expect(log.debug).toHaveBeenCalledOnce()
})

/**
 * Builds a reading at `place` that shows on a fresh Outside accessory.
 */
function meter(
  bridge : Bridge,
  log    : Logging,
  place  : Place
): { accessory: PlatformAccessory, reading: Reading } {
  const accessory = bridge.cached()
  const estimator = new Estimator(new ClearSky(), new Sun(place))

  return { accessory, reading: new Reading(estimator, log, new OutsideSensor(accessory, bridge.api)) }
}
