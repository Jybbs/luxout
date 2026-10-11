import { fc, test }   from '@fast-check/vitest'
import { expect, it } from 'vitest'

import { Place }               from '../../src/config/place.js'
import { ClearSky }            from '../../src/daylight/clear-sky.js'
import { CloudFactor }         from '../../src/daylight/cloud-factor.js'
import { Sun }                 from '../../src/daylight/sun.js'
import type { ForecastWindow } from '../../src/weather/window.js'
import { parsed, spaced }      from '../common/window.js'
import dawn                    from './fixtures/dawn.json' with { type: 'json' }
import dusk                    from './fixtures/dusk.json' with { type: 'json' }

/**
 * The factors of the four daylight steps that close the evening in `dusk.json`,
 * fetched for Los Angeles, and of the four that open the morning in
 * `dawn.json`, fetched for New Delhi. Each is the step's irradiance over the
 * Haurwitz irradiance 1098 cos z exp(-0.057 / cos z) at the step's refracted
 * zenith angle z.
 */
const EVENING  = [0.454493, 0.701868, 0.521517, 0.373257] as const
const MORNING  = [0.504787, 0.462013, 0.446452, 0.437864] as const
const HOUR     = 3_600_000
const STEP     = 900_000
const angeles  = new Place(34.05223, -118.24368)
const delhi    = new Place(28.62137, 77.2148)
const helsinki = new Place(60.16952, 24.93545)
const instants = fc.date({
  max           : new Date('2026-10-11T06:45:00Z'),
  min           : new Date('2026-10-11T00:00:00Z'),
  noInvalidDate : true
})
const sky     = new ClearSky()
const tromso  = new Place(69.6489, 18.95508)
const evening = parsed(dusk, angeles)
const morning = parsed(dawn, delhi)

it('divides a daylight step’s irradiance by the Haurwitz irradiance of equation 18', () => {
  expect(factors(evening).slice(0, 4)).toEqual(EVENING.map((share) => expect.closeTo(share, 6)))
})

it.each([
  { factor: 1, irradiance: 2000, name: 'above the clear sky' },
  { factor: 0, irradiance: -10,  name: 'at a negative irradiance' }
])('clamps the factor of a daylight step $name to $factor', ({ factor, irradiance }) => {
  expect(factors(spaced([irradiance, irradiance], delhi, '2026-10-11T06:00:00Z'))).toEqual([factor, factor])
})

it('gives every step of a dusk the mean factor of the evening’s last four daylight steps', () => {
  expect(factors(evening).slice(4)).toEqual(Array(24).fill(expect.closeTo(mean(EVENING), 6)))
})

it('gives every step of a dawn the mean factor of the morning’s first four daylight steps', () => {
  expect(factors(morning).slice(0, 6)).toEqual(Array(6).fill(expect.closeTo(mean(MORNING), 6)))
})

it('carries the evening’s factor into a window fetched once its daylight steps have left', () => {
  const night = later(evening, 4)

  expect(factors(night, derive(evening))).toEqual(Array(28).fill(expect.closeTo(mean(EVENING), 6)))
})

it('takes 1 through a dusk whose daylight steps neither the window nor an earlier one holds', () => {
  expect(factors(later(evening, 4))).toEqual(Array(28).fill(1))
})

it('takes each daylight step from the newest window holding it', () => {
  const revised = spaced([2000, 2000, 2000, ...Array(25).fill(0)], angeles, '2026-10-11T00:15:00Z')

  expect(factors(revised, derive(evening))[3]).toBeCloseTo((EVENING[0] + 3) / 4, 6)
})

it('reaches 12 hours back for the daylight steps a step below the floor takes', () => {
  const noon  = derive(spaced(Array(28).fill(20), helsinki, '2026-12-21T08:00:00Z'))
  const night = derive(spaced(Array(28).fill(0), helsinki, '2026-12-21T20:00:00Z'), noon)

  expect(at(night, '2026-12-21T23:30:00Z')).toBe(at(noon, '2026-12-21T11:30:00Z'))
  expect(at(night, '2026-12-21T23:45:00Z')).toBe(1)
})

it('reaches 4 hours ahead for the daylight steps a step below the floor takes', () => {
  const irradiances = [...Array(22).fill(0), ...dawn.minutely_15.shortwave_radiation_instant.slice(6, 12)]
  const night       = derive(spaced(irradiances, delhi, '2026-10-10T20:00:00Z'))

  expect(at(night, '2026-10-10T21:15:00Z')).toBe(1)
  expect(at(night, '2026-10-10T21:30:00Z')).toBeCloseTo(MORNING[0], 6)
  expect(at(night, '2026-10-10T22:15:00Z')).toBeCloseTo(mean(MORNING), 6)
})

it('takes 1 through a day the sun never climbs to the floor', () => {
  expect(factors(spaced(Array(28).fill(5), tromso, '2026-12-21T08:00:00Z'))).toEqual(Array(28).fill(1))
})

it('counts a step at the tuning’s floor as daylight', () => {
  expect(at(tuned(0), '2026-10-11T01:30:00Z')).toBeCloseTo(MORNING[0], 6)
})

it('gives a step a hair below the tuning’s floor the mean factor of the four daylight steps after it', () => {
  const factor = derive(morning)
  const after  = morning.times.slice(7, 11).map((time) => at(factor, time) ?? NaN)

  expect(at(tuned(1e-9), '2026-10-11T01:30:00Z')).toBeCloseTo(mean(after), 6)
})

it('interpolates nothing from a window holding no step, whatever an earlier one carries', () => {
  const empty = derive(spaced([], delhi, '2026-10-11T00:00:00Z'), derive(morning))

  expect(empty.at(new Date('2026-10-11T02:00:00Z'))).toBeUndefined()
})

it('interpolates the factor linearly between the steps on either side of an instant', () => {
  const [, , third, fourth] = MORNING

  expect(derive(morning).at(new Date('2026-10-11T02:07:30Z'))).toEqual({
    factor : expect.closeTo((third + fourth) / 2, 6),
    steps  : [
      { factor: expect.closeTo(third, 6), time: Date.parse('2026-10-11T02:00:00Z') },
      { factor: expect.closeTo(fourth, 6), time: Date.parse('2026-10-11T02:15:00Z') }
    ]
  })
})

it.each([
  { instant: '2026-10-10T23:59:59Z', name: 'a second before the first step' },
  { instant: '2026-10-11T06:45:01Z', name: 'a second after the last step' }
])('interpolates nothing $name', ({ instant }) => {
  expect(derive(morning).at(new Date(instant))).toBeUndefined()
})

test.prop([fc.array(fc.double({ max: 2000, min: -100, noNaN: true }), { maxLength: 28, minLength: 28 })])(
  'keeps every factor between 0 and 1',
  (irradiances) => {
    const window = spaced(irradiances, delhi, '2026-10-11T00:00:00Z')
    const shares = factors(window).map((factor) => factor ?? NaN)

    expect(Math.min(...shares)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...shares)).toBeLessThanOrEqual(1)
  }
)

test.prop([instants])(
  'interpolates within the factors of the two steps around an instant',
  (instant) => {
    const interpolation              = derive(morning).at(instant)
    const [before = NaN, after = NaN] = interpolation?.steps.map((step) => step.factor) ?? []

    expect(interpolation?.factor).toBeGreaterThanOrEqual(Math.min(before, after))
    expect(interpolation?.factor).toBeLessThanOrEqual(Math.max(before, after))
  }
)

test.prop([
  fc.double({ max: 89, min: -89, noNaN: true }),
  fc.double({ max: 180, min: -180, noNaN: true }),
  fc.integer({ max: 499_000, min: 491_000 }),
  fc.integer({ max: 59, min: 0 }),
  fc.array(fc.double({ max: 1000, min: 0, noNaN: true }), { maxLength: 80, minLength: 80 })
])(
  'keeps the factor at the minute a window replaces the one before it',
  (latitude, longitude, hours, minute, irradiances) => {
    const place   = new Place(latitude, longitude)
    const fetched = (hour: number): number => (hours + hour) * HOUR + minute * 60_000
    const chain   = Array.from({ length: 14 }).reduce<CloudFactor[]>((built, _, hour) => {
      const first  = Math.floor(fetched(hour) / STEP) * STEP - 4 * STEP
      const window = spaced(irradiances.slice(hour * 4, hour * 4 + 28), place, first)

      return [...built, derive(window, built.at(-1))]
    }, [])

    expect(at(chain.at(-1), fetched(13))).toBeCloseTo(at(chain.at(-2), fetched(13)) ?? NaN, 12)
  }
)

function at(factor: CloudFactor | undefined, time: number | string): number | undefined {
  return factor?.at(new Date(time))?.factor
}

function derive(window: ForecastWindow, earlier?: CloudFactor): CloudFactor {
  return new CloudFactor(sky, new Sun(window.place.latitude, window.place.longitude), window, earlier)
}

function factors(window: ForecastWindow, earlier?: CloudFactor): (number | undefined)[] {
  const factor = derive(window, earlier)

  return window.times.map((time) => at(factor, time))
}

function later(window: ForecastWindow, steps: number): ForecastWindow {
  const irradiances = [...window.irradiances.slice(steps), ...Array(steps).fill(0)]

  return spaced(irradiances, window.place, (window.times[0] ?? NaN) + steps * STEP)
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function tuned(above: number): CloudFactor {
  const sun   = new Sun(delhi.latitude, delhi.longitude)
  const floor = sky.refracted(sun.altitude(new Date('2026-10-11T01:30:00Z'))) + above

  return new CloudFactor(sky, sun, morning, undefined, {
    ahead   : 14_400_000,
    behind  : 43_200_000,
    floor   : floor,
    nearest : 4
  })
}
