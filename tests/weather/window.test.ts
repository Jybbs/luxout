import { fc, test }   from '@fast-check/vitest'
import { expect, it } from 'vitest'

import { Place }          from '../../src/config/place.js'
import { ForecastWindow } from '../../src/weather/window.js'
import { parsed }         from '../common/window.js'
import forecast           from './fixtures/forecast.json' with { type: 'json' }

const DAY      = 86_400_000
const first    = Date.parse('2026-10-04T10:15:00Z')
const last     = Date.parse('2026-10-04T17:00:00Z')
const place    = new Place(42.35843, -71.05977)
const readings = fc.array(fc.double({ max: 1400, min: 0, noNaN: true }))
const starts   = fc.integer({ max: 2_000_000_000, min: 0 })
const steps    = forecast.minutely_15
const around   = fc.integer({ max: last + DAY, min: first - DAY })
const inside   = fc.integer({ max: last, min: first })
const window   = parsed(forecast, place)

it('holds one time in milliseconds and one irradiance per step of the forecast', () => {
  expect(window).toMatchObject({
    irradiances : steps.shortwave_radiation_instant,
    place       : place,
    times       : steps.time.map((seconds) => seconds * 1000)
  })
})

it('ignores every field Open-Meteo sends beside the steps', () => {
  const body = {
    ...forecast,
    generationtime_ms : 0.047,
    latitude          : 42.365166,
    minutely_15       : { ...steps, cloud_cover: steps.time.map(() => 100) },
    minutely_15_units : { shortwave_radiation_instant: 'W/m²', time: 'unixtime' }
  }

  expect(parsed(body, place)).toEqual(window)
})

it('fails a body missing minutely_15', () => {
  expect(ForecastWindow.parse({}, place)).toMatchObject({
    message : 'missing_value at .minutely_15 (missing value)',
    ok      : false
  })
})

it.each([
  {
    message : 'missing_value at .minutely_15.shortwave_radiation_instant (missing value)',
    name    : 'steps missing the irradiances',
    steps   : { time: steps.time }
  },
  {
    message : 'custom_error at .minutely_15 (the step times and the irradiances differ in length)',
    name    : 'arrays that differ in length',
    steps   : { ...steps, time: steps.time.slice(1) }
  },
  {
    message : 'custom_error at .minutely_15 (the steps sit other than 900 seconds apart)',
    name    : 'steps 1800 seconds apart',
    steps   : { ...steps, time: steps.time.map((seconds, index) => seconds + index * 900) }
  },
  {
    message : 'custom_error at .minutely_15 (the steps sit other than 900 seconds apart)',
    name    : 'one step a second late',
    steps   : { ...steps, time: steps.time.map((seconds, index) => index === 5 ? seconds + 1 : seconds) }
  },
  {
    message : 'invalid_type at .minutely_15.shortwave_radiation_instant.5 (expected number)',
    name    : 'an irradiance that is null',
    steps   : { ...steps, shortwave_radiation_instant: nulled(steps.shortwave_radiation_instant, 5) }
  },
  {
    message : 'invalid_type at .minutely_15.time.0 (expected number) (+ 27 other issues)',
    name    : 'step times written as strings',
    steps   : { ...steps, time: steps.time.map(String) }
  }
])('fails $name', ({ message, steps }) => {
  expect(ForecastWindow.parse({ minutely_15: steps }, place)).toMatchObject({ message, ok: false })
})

it.each([
  { bracket: undefined, instant: '2026-10-04T10:14:59Z', name: 'a second before the first step' },
  { bracket: [0, 1],    instant: '2026-10-04T10:15:00Z', name: 'the first step' },
  { bracket: [0, 1],    instant: '2026-10-04T10:20:00Z', name: 'a minute between the first two steps' },
  { bracket: [0, 1],    instant: '2026-10-04T10:30:00Z', name: 'the second step' },
  { bracket: [1, 2],    instant: '2026-10-04T10:30:01Z', name: 'a second after the second step' },
  { bracket: [26, 27],  instant: '2026-10-04T16:59:59Z', name: 'a second before the last step' },
  { bracket: [26, 27],  instant: '2026-10-04T17:00:00Z', name: 'the last step' },
  { bracket: undefined, instant: '2026-10-04T17:00:01Z', name: 'a second after the last step' }
])('brackets $name with $bracket', ({ bracket, instant }) => {
  expect(window.bracket(new Date(instant))).toEqual(bracket)
})

test.prop([inside])('brackets an instant in the window by two adjacent steps', (time) => {
  const [before = NaN, after = NaN] = window.bracket(new Date(time)) ?? []

  expect(after - before).toBe(1)
  expect(window.times[before]).toBeLessThanOrEqual(time)
  expect(window.times[after]).toBeGreaterThanOrEqual(time)
})

test.prop([around])('covers the instants from the first step to the last', (time) => {
  expect(window.covers(new Date(time))).toBe(time >= first && time <= last)
})

it.each([
  { name: 'no step', time: [] },
  { name: 'one step', time: steps.time.slice(0, 1) }
])('covers no instant in a window holding $name', ({ time }) => {
  const short = parsed({ minutely_15: { shortwave_radiation_instant: time.map(() => 0), time } }, place)

  expect(short.covers(new Date(first))).toBe(false)
})

it('shapes the window as the body it parsed, beside the coordinates of its place', () => {
  expect(window.toJSON()).toEqual({ latitude: 42.36, longitude: -71.06, ...forecast })
})

test.prop([starts, readings])('restores every window from the shape it stores', (start, irradiances) => {
  const time   = irradiances.map((_, index) => start + index * 900)
  const stored = parsed({ minutely_15: { shortwave_radiation_instant: irradiances, time } }, place)

  expect(ForecastWindow.restore(stored.toJSON())).toEqual({ ok: true, value: stored })
})

it('fails a stored window missing the coordinates of its place', () => {
  expect(ForecastWindow.restore(forecast)).toMatchObject({
    message : 'missing_value at .latitude (missing value) (+ 1 other issue)',
    ok      : false
  })
})

function nulled(values: number[], index: number): (number | null)[] {
  return values.map((value, at) => at === index ? null : value)
}
