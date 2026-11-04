import { extent, max, min } from 'd3-array'
import { expect, it, vi }   from 'vitest'

import { ThresholdEntry } from '../../../../../src/config/threshold.ts'
import { theGap }         from '../../../lib/daylight/gap.ts'
import { SampleDay }      from '../../../lib/daylight/sample-day.ts'
import { tenth }          from '../../../lib/daylight/tenth.ts'
import { data }           from '../../common/data/daylight.ts'

const { gap }           = data
const [without, within] = gap.sensors

it('fails where the plugin rejects a level the drawing sets', () => {
  vi.spyOn(ThresholdEntry, 'parse').mockReturnValue({ line: 'rejected' } as never)

  expect(() => theGap(SampleDay.record())).toThrow('rejected')
})

it('switches the sensor without a gap more often than the sensor with one', () => {
  expect(without.switches).toBeGreaterThan(within.switches)
})

it('rests on a minute inside the gap, after the sensor with a gap turns on', () => {
  const { cells } = gap.minutes[gap.rest]!

  expect(cells[1]!.word).toBe('Holds on')
})

it('gives each sensor one cell per minute of the span', () => {
  expect(gap.minutes.every(({ cells }) => cells.length === gap.sensors.length)).toBe(true)
  expect(gap.minutes).toHaveLength(106)
})

it('reaches the count of each sensor at the last minute', () => {
  expect(gap.minutes.at(-1)!.cells.map(({ count }) => count)).toEqual(
    gap.sensors.map(({ switches }) => `${switches} of ${switches}`)
  )
})

it('names the switch a sensor makes at the minute it counts it', () => {
  const cells = (clock: string) => gap.minutes.find((minute) => minute.clock === clock)!.cells

  expect(cells('11:42')[1]).toEqual({ count: '1 of 1', mark: 'ring', word: 'Turns on' })
  expect(cells('11:50')[0]).toEqual({ count: '2 of 5', mark: 'ring', word: 'Turns off' })
})

it('sets the mark beside each word a sensor shows', () => {
  const pairs = gap.minutes.flatMap(({ cells }) => cells.map(({ mark, word }) => `${mark}: ${word}`))

  expect(new Set(pairs)).toEqual(
    new Set(['off: Off', 'on: Holds on', 'on: On', 'ring: Turns off', 'ring: Turns on'])
  )
})

it('says the direction in words', () => {
  expect(gap.direction).toBe(
    'whose on level of 74,000 lux sits above its off level of 70,000 turns on as the reading rises to the '
    + 'on level and off once it falls below the off level'
  )
})

it.each(gap.layouts)('keeps the reading of the $width layout above its lanes', (layout) => {
  const { lanes, left, right, x, y } = layout

  expect(extent(x)).toEqual([left, right])
  expect(max(y)).toBeLessThan(lanes[0]!.chip)
  expect(min(y)).toBeGreaterThanOrEqual(0)
})

it('rounds every coordinate to a tenth', () => {
  const figures = gap.layouts.flatMap(({ path, x, y }) => [
    ...x,
    ...y,
    ...path.matchAll(/-?\d+(\.\d+)?/g).map(([figure]) => Number(figure))
  ])

  expect(figures.filter((figure) => tenth(figure) !== figure)).toEqual([])
})

it.each(gap.layouts)('draws one ring per switch and one tie per crossing at $width', ({ lanes, ties }) => {
  expect(lanes.map(({ rings }) => rings.length)).toEqual(gap.sensors.map(({ switches }) => switches))
  expect(ties).toHaveLength(without.switches)
})

it('writes a minute as its clock and its lux', () => {
  expect(gap.minutes[0]!.reading).toMatch(/^11:15, [\d,]+ lux$/)
})

it('says each sensor’s minute in the words a screen reader speaks', () => {
  expect(gap.minutes[0]!.spoken).toMatch(/^11:15, [\d,]+ lux\. Without a gap, .+\. With a gap, .+\.$/)
})

it('labels each lane with the spans its sensor holds on', () => {
  expect(within.label).toMatch(/^With a gap, the sensor is on from \d\d:\d\d to \d\d:\d\d, switching once$/)
})
