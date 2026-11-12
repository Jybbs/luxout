import { expect, it } from 'vitest'

import { STEP_MINUTES }            from '../../../lib/daylight/clock.ts'
import { heldWord }                from '../../../lib/daylight/factor-day.ts'
import { formatFactor, formatLux } from '../../../lib/daylight/format.ts'
import { luxRange }                from '../../../lib/daylight/homekit.ts'
import { SampleDay }               from '../../../lib/daylight/sample-day.ts'
import { data }                    from '../../common/data/factor-day.ts'

const { curve, factor, minutes, outside, range, rest, terms, track, width } = data
const day                     = SampleDay.record()
const [clear, cloud, reading] = terms

it('writes the three terms in the order the line sets them, the clear sky first', () => {
  expect(terms.map(({ name }) => name)).toEqual(['Clear sky', 'Cloud factor', 'Reading'])
})

it('writes a clock word for each minute of the day', () => {
  expect(minutes).toHaveLength(SampleDay.MINUTES)
})

it.each(terms)('writes every figure of $name for each minute of the day', ({ figures, sources }) => {
  expect([figures.length, sources.length]).toEqual([SampleDay.MINUTES, SampleDay.MINUTES])
})

it('writes the clear sky, the factor, and the reading the plugin reports at a minute', () => {
  expect([clear.figures[rest], cloud.figures[rest], reading.figures[rest]]).toEqual([
    formatLux(day.clearSkies[rest]!),
    formatFactor(day.factors[rest]!),
    formatLux(day.readings[rest]!)
  ])
})

it('names the two steps around a minute inside the window', () => {
  const [from] = day.span

  expect(cloud.sources[from + 7]).toBe(`Between ${day.clock(from)} and ${day.clock(from + STEP_MINUTES)}`)
  expect(outside[from + 7]).toBe(false)
})

it('names a minute no window covers', () => {
  expect(cloud.sources[0]).toBe(`No window covers ${minutes[0]}`)
  expect(outside[0]).toBe(true)
})

it.each([
  { minute: 0, word: 'Lifted to HomeKit’s floor' },
  { minute: SampleDay.NOON, word: 'Inside HomeKit’s range' }
])('writes the reading’s source at minute $minute as: $word', ({ minute, word }) => {
  expect(reading.sources[minute]).toBe(word)
})

it.each([
  { lux: luxRange.min / 2, word: 'Lifted to HomeKit’s floor' },
  { lux: luxRange.min, word: 'Inside HomeKit’s range' },
  { lux: luxRange.max, word: 'Inside HomeKit’s range' },
  { lux: luxRange.max * 2, word: 'Held at HomeKit’s ceiling' }
])('writes a reading of $lux lux as: $word', ({ lux, word }) => {
  expect(heldWord(lux)).toBe(word)
})

it('places the sun off the curve where it sits below the altitudes drawn', () => {
  expect(curve.x[0]).toBeUndefined()
  expect(curve.x[SampleDay.NOON]).toBeGreaterThan(0)
})

it('places the clear sky’s dot off the range where it sits under HomeKit’s floor', () => {
  expect(range.clear[0]).toBeUndefined()
  expect(range.reading[0]).toBe(0)
})

it('marks the steps whose sun stands below the plugin’s floor', () => {
  const low = factor.steps.filter((step) => step.low)

  expect(low.length).toBeGreaterThan(0)
  expect(low.length).toBeLessThan(factor.steps.length)
  expect(factor.steps[0]!.low).toBe(true)
  expect(factor.steps.at(-1)!.low).toBe(false)
})

it('labels the window’s two ends with their clock times', () => {
  expect(factor.window.map(({ word }) => word)).toEqual(day.span.map((minute) => day.clock(minute)))
})

it('sets the window on the time track as a share of the day', () => {
  expect(track.from).toBeCloseTo(day.span[0] / SampleDay.MINUTES * 100, 1)
  expect(track.to).toBeCloseTo(day.span[1] / SampleDay.MINUTES * 100, 1)
})

it('draws HomeKit’s range across the plot’s whole width', () => {
  expect(range.reading.every((x) => x >= 0 && x <= width)).toBe(true)
  expect(range.ends).toEqual([formatLux(luxRange.min), formatLux(luxRange.max)])
})

it('ticks each of the ten powers of ten across HomeKit’s range', () => {
  expect(range.axis.match(/V/g)).toHaveLength(10)
})

it('draws the factor’s fall outside the window on the line of a factor of 1', () => {
  const one = factor.yWords[0]!

  expect(one.word).toBe('1')
  expect(factor.fall).toContain(` ${one.y}H`)
})
