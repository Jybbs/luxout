import { expect, it } from 'vitest'

import * as clock from '../../../lib/daylight/clock.ts'

it('holds a day of 1440 minutes in milliseconds', () => {
  expect([clock.DAY_MINUTES, clock.MINUTE, clock.DAY]).toEqual([1440, 60_000, 86_400_000])
})

it('writes each hour the clock marks as two digits', () => {
  expect(clock.HOUR_MARKS.map(clock.hourWord)).toEqual(['00', '06', '12', '18', '24'])
})

it.each([
  { expected: '00:00', timeZone: 'UTC' },
  { expected: '09:00', timeZone: 'Asia/Tokyo' },
  { expected: '19:00', timeZone: 'America/New_York' }
])('writes the epoch in $timeZone as $expected on a 24-hour clock', ({ expected, timeZone }) => {
  expect(clock.clockFormatIn(timeZone).format(0)).toBe(expected)
})

it.each([
  { expected: 'January 1', timeZone: 'UTC' },
  { expected: 'December 31', timeZone: 'America/New_York' }
])('writes the date of the epoch in $timeZone as $expected', ({ expected, timeZone }) => {
  expect(clock.dateFormatIn(timeZone).format(0)).toBe(expected)
})
