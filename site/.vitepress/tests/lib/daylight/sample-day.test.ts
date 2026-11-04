import { expect, it, vi } from 'vitest'

import { ForecastWindow }    from '../../../../../src/weather/window.ts'
import { luxRange }          from '../../../lib/daylight/homekit.ts'
import { SampleDay, runsOf } from '../../../lib/daylight/sample-day.ts'

const day = SampleDay.record()

it('reads every minute of the day and the midnight that closes it', () => {
  expect([day.readings.length, day.altitudes.length]).toEqual([SampleDay.MINUTES + 1, SampleDay.MINUTES + 1])
})

it('clamps every reading into the range the characteristic accepts', () => {
  expect(day.readings.every((lux) => lux >= luxRange.min && lux <= luxRange.max)).toBe(true)
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
