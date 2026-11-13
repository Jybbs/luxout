import { pairs }      from 'd3-array'
import { expect, it } from 'vitest'

import { SCHEDULE_TUNING }            from '../../../../../src/weather/schedule.ts'
import { MINUTE }                     from '../../../lib/daylight/clock.ts'
import { SampleDay }                  from '../../../lib/daylight/sample-day.ts'
import { requestClock, retryOffsets } from '../../../lib/privacy/request-clock.ts'
import { data }                       from '../../common/data/privacy.ts'

const { clock } = data

function headingOf(path: string): number {
  const [ax, ay, bx, by] = path.match(/-?[\d.]+/g)!.map(Number) as [number, number, number, number]

  return (Math.atan2(bx - ax, ay - by) / (2 * Math.PI) * 60 + 60) % 60
}

it('retries a failing hour a minute after its request and doubles each wait', () => {
  expect(retryOffsets(SCHEDULE_TUNING.retry)).toEqual([1, 3, 7, 15, 31])
})

it.each([1, 2, 5, 10, 30, 59])('stops retrying from a %i-minute wait before the next request', (first) => {
  const offsets = retryOffsets(first * MINUTE)
  const waits   = pairs([0, ...offsets], (from, to) => to - from)

  expect(offsets[0]).toBe(first)
  expect(offsets.at(-1)! + 2 * waits.at(-1)!).toBeGreaterThanOrEqual(60)
  expect(waits.slice(1)).toEqual(waits.slice(0, -1).map((wait) => 2 * wait))
})

it('schedules no retry where the first wait already reaches the next hourly request', () => {
  expect(retryOffsets(60 * MINUTE)).toEqual([])
})

it('marks each retry on the minute it runs at, outside the rim', () => {
  const minutes = retryOffsets(SCHEDULE_TUNING.retry).map((offset) => clock.minute + offset)

  expect(clock.retries.map((path) => Math.round(headingOf(path)))).toEqual(minutes)
  expect(clock.said.map(({ word }) => word)).toEqual(minutes.map((minute) => `:${minute % 60}`))
})

it('quiets a quarter hour’s word only where a retry runs within three minutes of it', () => {
  expect(clock.quarters.map(({ quiet, word }) => [word, quiet]))
    .toEqual([[':00', false], [':15', false], [':30', true], [':45', false]])
})

it('draws the hand from the core toward the request’s minute', () => {
  expect(Math.round(headingOf(clock.hand))).toBe(clock.minute)
  expect(Math.hypot(clock.heading[0], clock.heading[1])).toBeCloseTo(1)
})

it('sets the request’s dot on the rim at its minute', () => {
  const [x, y] = clock.request

  expect(Math.hypot(x - clock.side / 2, y - clock.side / 2)).toBeCloseTo(clock.radii.rim, 0)
})

it('names the request’s minute, the rounded pair, and each retry in the tabs', () => {
  const [often, sends, fails] = clock.states

  expect(often!.text).toBe('One request an hour, at 17 past, a minute drawn at random when Homebridge '
    + 'starts, so 24 requests a day.')
  expect(sends!.big).toBe('42.36\n−71.06')
  expect(fails!.text).toBe('The 08:17 request fails and is retried at 08:18, 08:20, 08:24, 08:32, and '
    + '08:48, each wait twice the last, then nothing more until 09:17, while the reading keeps using the '
    + '07:17 forecast.')
  expect(fails!.small).toBe('fails, then five retries')
})

it('lays the same hour out on each build of the sample day', () => {
  expect(requestClock(SampleDay.record())).toEqual(clock)
})
