import { max, sort }  from 'd3-array'
import { expect, it } from 'vitest'

import { DAY }        from '../../../lib/daylight/clock.ts'
import { SampleDay }  from '../../../lib/daylight/sample-day.ts'
import { SUN_GRID }   from '../../../lib/daylight/sun-curve.ts'
import { shareWords } from '../../../lib/daylight/sun-year.ts'
import { data }       from '../../common/data/sun-year.ts'

const { days, lede, marks, minutes, months, rest, sample, year } = data

const dayOf = (month: number, date: number) => (Date.UTC(year, month, date) - Date.UTC(year, 0, 1)) / DAY

it('samples every day of the sample day’s year', () => {
  expect([year, days.length]).toEqual([2026, 365])
})

it('sets the sample on the day the estimate runs', () => {
  expect(sample).toBe(dayOf(9, 4))
})

it('samples each day of the year every half hour, the closing midnight included', () => {
  expect(days.every(({ altitudes }) => altitudes.length === SampleDay.MINUTES / SUN_GRID + 1)).toBe(true)
})

it('rests at 10:00 on a minute the sample day reaches', () => {
  expect(rest).toBe(600)
  expect(minutes).toHaveLength(SampleDay.MINUTES + 1)
})

it('names the equinoxes, the solstices, and the sample day', () => {
  expect(marks.filter((mark) => mark.named).map((mark) => mark.day))
    .toEqual(sort([dayOf(2, 20), dayOf(5, 21), dayOf(8, 22), sample, dayOf(11, 21)]))
})

it('keeps the 21st of each other month as an unnamed curve', () => {
  expect(marks.filter((mark) => !mark.named).map((mark) => mark.day))
    .toEqual([0, 1, 3, 4, 6, 7, 9, 10].map((month) => dayOf(month, 21)))
})

it('keeps the marks in the order of the year', () => {
  const order = marks.map((mark) => mark.day)

  expect(order).toEqual(sort(order))
})

it('sets the summer sun higher and its day longer than the winter’s', () => {
  const [june, december] = [days[dayOf(5, 21)]!, days[dayOf(11, 21)]!]

  expect(june.peak.altitude).toBeGreaterThan(december.peak.altitude)
  expect(june.set - june.rise).toBeGreaterThan(december.set - december.rise)
})

it('moves the clock time of the top of the path by the hour the clock changes', () => {
  const [march, july] = [days[dayOf(2, 1)]!, days[dayOf(6, 1)]!]

  expect(Math.abs(july.peak.minute - march.peak.minute - 60)).toBeLessThan(20)
})

it.each([
  { change: 'spring', month: 2, date: 8 },
  { change: 'fall', month: 10, date: 1 }
])('keeps the $change change of the clock’s afternoon on the new clock', ({ date, month }) => {
  const [changed, after] = [days[dayOf(month, date)]!, days[dayOf(month, date + 1)]!]

  expect(Math.abs(changed.peak.minute - after.peak.minute)).toBeLessThan(5)
})

it('finds the peak of the sample day from its minutes and writes it in the lede', () => {
  const { altitudes, date } = SampleDay.record()

  expect(days[sample]!.peak.altitude).toBeCloseTo(max(altitudes)!, 1)
  expect(lede.height).toBe(`${days[sample]!.peak.altitude.toFixed(1)}°`)
  expect(lede.opening).toBe(date)
})

it('writes the sun’s height as a plain share of straight overhead', () => {
  expect(lede.share).toBe(shareWords(days[sample]!.peak.altitude / 90))
})

it.each([
  { fraction: 0.5, words: 'about half' },
  { fraction: 0.505, words: 'about half' },
  { fraction: 0.48, words: 'a little under half' },
  { fraction: 0.52, words: 'a little over half' },
  { fraction: 0.1, words: 'a little under a quarter' },
  { fraction: 0.95, words: 'a little over three quarters' }
])('writes $fraction of the way overhead as: $words', ({ fraction, words }) => {
  expect(shareWords(fraction)).toBe(words)
})

it('writes each month once, in order, with its word inside the track', () => {
  expect(months.map(({ word }) => word)).toEqual([
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ])
  expect(months.every(({ left }) => left > 0 && left < 100)).toBe(true)
})
