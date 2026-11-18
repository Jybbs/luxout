import { range }      from 'd3-array'
import { expect, it } from 'vitest'

import { seeded } from '../../../lib/cards/seeded.ts'

it('repeats a seeded sequence inside the range from 0 to 1', () => {
  const [first, second] = [seeded(41), seeded(41)]
  const drawn           = range(100).map(() => first())

  expect(drawn).toEqual(range(100).map(() => second()))
  expect(drawn.filter((value) => value < 0 || value >= 1)).toStrictEqual([])
})
