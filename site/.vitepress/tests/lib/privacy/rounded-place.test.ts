import { sum }        from 'd3-array'
import { expect, it } from 'vitest'

import { type RoundedPlace, markAt } from '../../../lib/privacy/rounded-place.ts'
import { data }                      from '../../common/data/privacy.ts'

const { place }      = data
const { area, cell } = place

it('counts about ten areas sharing a rounded pair in one cell at Boston', () => {
  expect(place.count).toBe(10)
})

it('centers the rounded pair on the cell and the area that rounds to it', () => {
  const middle = cell.x + cell.width / 2

  expect(place.pair).toEqual([middle, middle])
  expect(area.x + area.width / 2).toBeCloseTo(middle, 0)
  expect(area.y + area.height / 2).toBeCloseTo(middle, 0)
})

it('rings the stored place on the pair, since the settings page stores the rounded figures', () => {
  expect(place.place).toEqual(place.pair)
  expect(place.marks.map(({ value }) => value).slice(0, 2)).toEqual(['42.36, −71.06', '42.36, −71.06'])
})

it('keeps every tile inside the cell', () => {
  expect(place.tiles.every(({ height, width, x, y }) =>
    x >= cell.x && y >= cell.y && x + width <= cell.x + cell.width && y + height <= cell.y + cell.height
  )).toBe(true)
})

it('tiles the whole cell, with no gap and no overlap', () => {
  const tiled = sum(place.tiles, ({ height, width }) => height * width)

  expect(tiled / (cell.height * cell.width)).toBeCloseTo(1, 2)
})

it('fills one of the tiles as the area holding the place', () => {
  expect(place.tiles).toContainEqual(area)
})

it('draws an area as tall as a hundredth of a degree of latitude on the cell’s scale', () => {
  expect(area.height / cell.height * 3).toBeCloseTo(1.11, 2)
})

it.each([
  ['the place, on the pair', place.pair, 'place'],
  ['the area, away from the pair', [area.x + 2, area.y + 2], 'area'],
  ['the cell, outside the area', [cell.x + 2, cell.y + 2], 'cell'],
  ['nothing, beneath the cell', [cell.x + 2, cell.y + cell.height + 10], undefined]
] as const)('names %s', (_, point, mark) => {
  expect(markAt(place, point)).toBe(mark)
})

it('names the nearer of the place and the pair where both lie within reach', () => {
  const apart: RoundedPlace = { ...place, place: [place.pair[0] + 8, place.pair[1]] }

  expect(markAt(apart, [place.pair[0] + 6, place.pair[1]])).toBe('place')
  expect(markAt(apart, [place.pair[0] + 2, place.pair[1]])).toBe('pair')
})
