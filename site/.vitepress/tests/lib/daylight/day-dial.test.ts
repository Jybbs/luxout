import { pairs, transpose } from 'd3-array'
import { expect, it }       from 'vitest'

import { CLOUD_TUNING } from '../../../../../src/daylight/cloud-factor.ts'
import { SampleDay }    from '../../../lib/daylight/sample-day.ts'
import { data }         from '../../common/data/day-dial.ts'

const { marks, opens, stretches } = data

const named = (name: string) => stretches.findIndex((stretch) => stretch.name === name)

it('reads the night, the dawn, the window, the day, and the dusk off the estimate', () => {
  expect(stretches.map(({ name }) => name)).toEqual(['Night', 'Dawn', 'Window', 'Day', 'Dusk'])
})

it('opens on the dawn', () => {
  expect(stretches[opens]!.name).toBe('Dawn')
})

it('marks the window alone as a stretch outside the dial', () => {
  expect(stretches.filter(({ outer }) => outer).map(({ name }) => name)).toEqual(['Window'])
})

it('runs the night from where the dusk ends past midnight to where the dawn begins', () => {
  const [from, to]   = marks.spans[named('Night')]!
  const [dawn]       = marks.spans[named('Dawn')]!
  const [, duskEnds] = marks.spans[named('Dusk')]!

  expect([from, to]).toEqual([duskEnds, SampleDay.MINUTES + dawn])
})

it('runs the day from the dawn’s end to the dusk’s start', () => {
  const [, rise] = marks.spans[named('Dawn')]!
  const [set]    = marks.spans[named('Dusk')]!

  expect(marks.spans[named('Day')]).toEqual([rise, set])
})

it('sets the window’s minutes on the track outside the dial', () => {
  expect(marks.window).toEqual(marks.spans[named('Window')])
})

it('nests each depth of twilight inside the one before it', () => {
  const [morning, evening] = transpose(marks.washes)

  expect([...morning!, ...evening!].every(([from, to]) => from < to)).toBe(true)
  expect(pairs(morning!).every(([outer, inner]) => outer[1] === inner[0])).toBe(true)
  expect(pairs(evening!).every(([outer, inner]) => outer[0] === inner[1])).toBe(true)
})

it.each([
  { name: 'reading', shares: marks.reading },
  { name: 'clear sky', shares: marks.clear }
])('writes a share from 0 to 1 for each minute of the $name', ({ shares }) => {
  expect(shares).toHaveLength(SampleDay.MINUTES)
  expect(shares.every((share) => share >= 0 && share <= 1)).toBe(true)
})

it('places the reading on the floor ring at midnight and off it at noon', () => {
  expect(marks.reading[0]).toBe(0)
  expect(marks.reading[SampleDay.NOON]).toBeGreaterThan(0.9)
})

it.each(stretches)('holds the name $name inside the dial’s drawing', ({ place }) => {
  expect(place.left).toBeGreaterThan(0)
  expect(place.left).toBeLessThan(100)
  expect(place.top).toBeGreaterThan(0)
  expect(place.top).toBeLessThan(100)
})

it('writes each stretch’s span as two clock times', () => {
  expect(stretches.every(({ span }) => /^\d\d:\d\d–\d\d:\d\d$/.test(span))).toBe(true)
})

it('gives the night’s figure as HomeKit’s floor', () => {
  expect(stretches[named('Night')]!.figure).toBe('0.0001')
})

it('names the plugin’s own floor and count in the window’s reason', () => {
  const { why } = stretches[named('Window')]!

  expect(why).toContain(`under ${CLOUD_TUNING.floor}°`)
  expect(why).toContain(`the ${CLOUD_TUNING.nearest} nearest`)
})

it('gives the window’s figure as the least and most a lit step takes', () => {
  expect(stretches[named('Window')]!.figure).toMatch(/^0\.\d{3}–(?:0\.\d{3}|1)$/)
})
