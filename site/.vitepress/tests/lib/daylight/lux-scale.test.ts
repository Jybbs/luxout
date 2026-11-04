import { wcagLuminance } from 'culori'
import { sort, sum }     from 'd3-array'
import { expect, it }    from 'vitest'

import { luxRange }  from '../../../lib/daylight/homekit.ts'
import { luxScale }  from '../../../lib/daylight/lux-scale.ts'
import { SampleDay } from '../../../lib/daylight/sample-day.ts'

const day   = SampleDay.record()
const scale = luxScale(day)

it('sets one tile per decade of the range the characteristic accepts', () => {
  expect(scale.decades).toHaveLength(Math.log10(luxRange.max / luxRange.min))
})

it('shades the tiles from dark to bright', () => {
  const luminance = scale.decades.map(({ fill }) => wcagLuminance(fill))

  expect(luminance).toEqual(sort(luminance))
})

it('accounts for every minute of the day across the decades', () => {
  expect(sum(scale.decades, ({ minutes }) => minutes)).toBe(SampleDay.MINUTES)
})

it('opens on the decade the reading stands in at noon', () => {
  const { range }   = scale.decades[scale.opening]!
  const [low, high] = range.split(' to ').map((part) => Number.parseFloat(part.replaceAll(',', '')))

  expect(day.readings[SampleDay.NOON]).toBeGreaterThanOrEqual(low!)
  expect(day.readings[SampleDay.NOON]).toBeLessThanOrEqual(high!)
})

it('names the day in the lede and marks the minutes of twilight in bold', () => {
  expect(scale.lede).toMatch(/ on October 4, .* \*\*\d+ to \d+ minutes\*\* in each step of twilight\.$/)
})

it('writes the times a decade holds as runs of the clock', () => {
  expect(scale.decades[0]!.day).toMatch(/^\d+ minutes, until \d\d:\d\d and from \d\d:\d\d$/)
})

it('sets the Illuminance table’s rows in the decade each one falls in', () => {
  const rows = scale.decades.flatMap(({ everyday, floor }) => everyday.map(({ name }) => [floor, name]))

  expect(rows).toContainEqual(['0.0001', 'Moonless, overcast night sky'])
  expect(rows).toContainEqual(['1,000', 'Overcast day'])
  expect(rows).toContainEqual(['10,000', 'Direct sunlight'])
  expect(rows).toHaveLength(15)
})

it('reaches each decade at a higher altitude than the one below it', () => {
  const lows = scale.decades.slice(1).map(({ clearSky }) =>
    Number.parseFloat(clearSky.replace('The sun from ', '').replace('−', '-'))
  )

  expect(lows).toEqual(sort(lows))
})
