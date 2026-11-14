import { pairs }      from 'd3-array'
import { expect, it } from 'vitest'

import { BRIDGE_SPAN, ClearSky } from '../../../../../src/daylight/clear-sky.ts'
import { SUNSET_WORD }           from '../../../lib/daylight/sun-curve.ts'
import { tenth }                 from '../../../lib/daylight/tenth.ts'
import { data }                  from '../../common/data/twilight-bridge.ts'

const { cut, decades, degrees, figures, height, high, label, low, phrases, rest, ticks, width, x, y } = data

it('stops at each tenth of a degree from −6° to 12°, with one more stop at the cutoff', () => {
  expect(x).toHaveLength(182)
  expect(degrees[0]).toBe('−6.0°')
  expect(degrees.at(-1)).toBe('12.0°')
  expect(degrees.slice(cut - 1, cut + 2)).toEqual(['−0.9°', SUNSET_WORD, '−0.8°'])
})

it('rests the sun at −3°, inside the span', () => {
  expect([degrees[rest], figures[rest]]).toEqual(['−3.0°', '68.8 lux'])
  expect(rest).toBeLessThan(cut)
})

it('writes each stop’s lux from the plugin’s curve', () => {
  expect(figures[0]).toBe('2.99 lux')
  expect(figures[cut]).toBe(`${Math.round(new ClearSky().illuminance(BRIDGE_SPAN[1]))} lux`)
  expect(figures.at(-1)).toBe('14,755 lux')
})

it('labels both ends of the span with the lux the plugin computes there', () => {
  expect(low).toEqual({ word: '2.99 lux', x: 0, y: y[0] })
  expect(high).toEqual({ word: '662 lux', x: x[cut], y: y[cut] })
})

it('names the span’s ends and its cutoff in the words a reader hears', () => {
  expect(label).toContain(`from ${low.word} to ${high.word}`)
  expect(label).toContain(SUNSET_WORD)
})

it('lays the stops left to right across the drawing, each to a tenth', () => {
  expect(x[0]).toBe(0)
  expect(x.at(-1)).toBe(width)
  expect(pairs(x).every(([left, right]) => left < right)).toBe(true)
  expect([...x, ...y].every((place) => tenth(place) === place)).toBe(true)
})

it('climbs at every stop, with no rise at the cutoff past what the span’s slope gives', () => {
  const rises = pairs(y).map(([left, right]) => left - right)
  const slope = rises[0]! / (x[1]! - x[0]!)

  expect(rises.every((rise) => rise > 0)).toBe(true)
  expect(rises[cut - 1]! / (x[cut]! - x[cut - 1]!)).toBeCloseTo(slope, 0)
})

it('sets the decades on the logarithmic scale, the lowest on the floor', () => {
  expect(decades.map(({ word }) => word)).toEqual(['1', '10', '100', '1,000', '10,000'])
  expect(decades[0]!.at).toBe(height)
  expect(decades.at(-1)!.at).toBeGreaterThan(0)
})

it('marks the odd ticks minor and writes the cutoff as its fraction', () => {
  expect(ticks.filter(({ minor }) => minor).map(({ word }) => word)).toEqual(['3°', '9°'])
  expect(ticks.map(({ word }) => word)).toEqual(['−6°', SUNSET_WORD, '3°', '6°', '9°', '12°'])
  expect(ticks.find(({ word }) => word === SUNSET_WORD)!.at).toBe(x[cut])
})

it('holds one phrase for each side of the cutoff and one for the cutoff itself', () => {
  expect(new Set(phrases).size).toBe(3)
})
