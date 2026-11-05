import { cross, max, range, sort } from 'd3-array'
import { expect, it }              from 'vitest'

import * as dialLens from '../../../lib/daylight/dial-lens.ts'
import { data }      from '../../common/data/day-dial.ts'

const { marks, stretches } = data

const TAU       = 2 * Math.PI
const plot      = new dialLens.DialPlot(marks)
const bracketOf = (half: dialLens.Half, stretch: number) =>
  plot.paths(half, 0).at(-1 - (stretches.length - stretch) * 2)

it('finds the dawn in the first half of the clock and the dusk in the second', () => {
  expect(dialLens.HALVES.map((half) => stretches[plot.twilight(half)]!.name)).toEqual(['Dawn', 'Dusk'])
})

it.each(cross(dialLens.HALVES, range(0, 720, 60)))(
  'holds half %i on the true clock %i minutes in while its twilight stays shut',
  (half, past) => {
    const minute = half * 720 + past

    expect(plot.turn(half, minute, 0)).toBeCloseTo(minute / 1440 * TAU, 12)
  }
)

it.each(dialLens.HALVES)('opens the twilight of half %i to a quarter of the dial', (half) => {
  const [from, to] = marks.spans[plot.twilight(half)]!

  expect(plot.turn(half, to, 1) - plot.turn(half, from, 1)).toBeCloseTo(TAU / 4, 2)
})

it.each(dialLens.HALVES)('leaves noon and midnight where they stand as half %i opens', (half) => {
  const low = half * 720

  expect(plot.turn(half, low, 1)).toBeCloseTo(low / 1440 * TAU, 12)
  expect(plot.turn(half, low + 720, 1)).toBeCloseTo((low + 720) / 1440 * TAU, 2)
})

it.each(cross(dialLens.HALVES, [1 / 3, 1]))(
  'keeps every minute of half %i in clock order with its twilight open by %d',
  (half, open) => {
    const low   = half * 720
    const turns = range(low, low + 720).map((minute) => plot.turn(half, minute, open))

    expect(turns).toEqual(sort(turns))
  }
)

it.each(cross(dialLens.HALVES, [0, 1 / 3, 1]))(
  'finds every minute of half %i from its own angle with its twilight open by %d',
  (half, open) => {
    const low    = half * 720
    const opens  = half ? [0, open] : [open, 0]
    const misses = range(low, low + 720).map((minute) =>
      Math.abs(plot.minuteAt(plot.turn(half, minute, open), opens) - minute)
    )

    expect(max(misses)).toBeLessThanOrEqual(1)
  }
)

it('reads an angle past the foot on the far side of the dial as the late evening', () => {
  expect(plot.minuteAt(-TAU / 1440 * 60, [0, 0])).toBe(1380)
})

it('writes as many paths at each opening, moving some of them', () => {
  const [shut, open] = [plot.paths(0, 0), plot.paths(0, 1)]

  expect(open).toHaveLength(shut.length)
  expect(open).not.toEqual(shut)
})

it('draws nothing in a half of the clock a stretch does not reach', () => {
  const dawn = stretches.findIndex(({ name }) => name === 'Dawn')

  expect(marks.spans[dawn]![1]).toBeLessThanOrEqual(720)
  expect(bracketOf(1, dawn)).toBe('')
})

it('draws the night, which runs past midnight, in both halves of the clock', () => {
  expect(dialLens.HALVES.map((half) => bracketOf(half, 0))).not.toContain('')
})

it('keeps a whole number of levels for the peek, which stops a third of the way', () => {
  expect(dialLens.OPENING_STEPS % 3).toBe(0)
})

it('places the floor ring three fifths of the way out to the rim', () => {
  expect(dialLens.DIAL.floor / dialLens.DIAL.rim).toBeCloseTo(3 / 5, 12)
})
