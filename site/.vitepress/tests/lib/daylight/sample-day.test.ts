import { expect, it, vi } from 'vitest'

import { CLOUD_TUNING }                          from '../../../../../src/daylight/cloud-factor.ts'
import { ForecastWindow }                        from '../../../../../src/weather/window.ts'
import { MINUTE, STEP_MINUTES }                  from '../../../lib/daylight/clock.ts'
import { luxRange }                              from '../../../lib/daylight/homekit.ts'
import { SampleDay, crossings, instant, runsOf } from '../../../lib/daylight/sample-day.ts'

const day = SampleDay.record()

it('reads every minute of the day and the midnight that closes it', () => {
  expect([day.readings.length, day.altitudes.length]).toEqual([SampleDay.MINUTES + 1, SampleDay.MINUTES + 1])
})

it('clamps every reading into the range the characteristic accepts', () => {
  expect(day.readings.every((lux) => lux >= luxRange.min && lux <= luxRange.max)).toBe(true)
})

it('reads the sun in the east before its noon and in the west after it', () => {
  expect([day.azimuth(480) < 180, day.azimuth(960) > 180]).toEqual([true, true])
})

it('names the day and writes a 24-hour clock in the zone of the sample place', () => {
  expect([day.date, day.clock(0), day.clock(675), day.clock(780)])
    .toEqual(['October 4', '00:00', '11:15', '13:00'])
})

it('reads the floor at midnight and a brighter reading at noon than at dawn', () => {
  expect(day.readings[0]).toBe(luxRange.min)
  expect(day.readings[SampleDay.NOON]).toBeGreaterThan(day.readings[420]!)
})

it.each([
  { lit: true, refracted: CLOUD_TUNING.floor },
  { lit: false, refracted: CLOUD_TUNING.floor - 0.01 }
])('reads the sun refracted to $refracted° as lit: $lit', ({ lit, refracted }) => {
  const fresh = SampleDay.record()

  vi.spyOn(fresh, 'refractedAt').mockReturnValue(refracted)

  expect(fresh.litAt(0)).toBe(lit)
})

it('finds the instant of a minute past midnight and the minute of an instant', () => {
  expect(instant(0).toISOString()).toBe('2026-10-04T04:00:00.000Z')
  expect(day.minuteOf(instant(615).getTime())).toBe(615)
})

it('writes the clock time of an instant', () => {
  expect(day.clockAt(instant(675).getTime())).toBe('11:15')
})

it('reads the sun’s refracted altitude at an instant', () => {
  expect(day.refractedAt(instant(0).getTime())).toBeLessThan(0)
  expect(day.refractedAt(instant(SampleDay.NOON).getTime())).toBeGreaterThan(0)
})

it('finds where the altitudes first rise to a level and first fall below it after', () => {
  expect(crossings([-2, 0, 3, 1, -1, 2], 0)).toEqual([1, 4])
})

it('spans the stored window from its first step to its last', () => {
  const [from, to] = day.span

  expect([day.clock(from), day.clock(to)]).toEqual(['06:15', '13:00'])
})

it('holds the steps of the stored window a forecast step apart', () => {
  const [first, second] = day.window.times

  expect(second! - first!).toBe(STEP_MINUTES * MINUTE)
})

it.each([
  { expected: [], flags: [false, false], name: 'no run' },
  { expected: [[0, 2]], flags: [true, true], name: 'a run filling the span' },
  { expected: [[1, 2]], flags: [false, true, false], name: 'a run inside the span' },
  { expected: [[0, 1], [2, 3]], flags: [true, false, true], name: 'a run at each end' }
])('finds $name, each end one past its last flag', ({ expected, flags }) => {
  expect(runsOf(flags)).toEqual(expected)
})

it('fails where the recorded forecast no longer parses', () => {
  vi.spyOn(ForecastWindow, 'parse').mockReturnValue({ message: 'unreadable', ok: false } as never)

  expect(() => SampleDay.record()).toThrow('unreadable')
})
