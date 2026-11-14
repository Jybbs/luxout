import { expect, it } from 'vitest'

import { creditRim } from '../../../lib/credit/credit.ts'
import { SEAL }      from '../../../lib/credit/seal-drawing.ts'
import { Seal }      from '../../../lib/credit/seal.ts'
import { SampleDay } from '../../../lib/daylight/sample-day.ts'

const { marks } = await Seal.read(new URL('../../../', import.meta.url))
const steps     = SampleDay.record().window.irradiances
const rotations = marks.rim.map(({ transform }) => Number(/rotate\((-?[\d.]+)\)/.exec(transform)![1]))

it('draws one mark for each step of the forecast, a dot for each step with no sunlight', () => {
  expect(marks.calm).toHaveLength(steps.filter((step) => step === 0).length)
  expect(marks.rays).toHaveLength(steps.filter((step) => step > 0).length)
})

it('sets the brightest step’s ray at the full length from the sun', () => {
  const lengths = marks.rays.map((d) => {
    const [x1, y1, x2, y2] = d.match(/-?[\d.]+/g)!.map(Number)

    return Math.hypot(x2! - x1!, y2! - y1!)
  })

  expect(Math.max(...lengths)).toBeCloseTo(SEAL.rays.length, 0)
})

it('letters each arc of the rim symmetrically about its own middle, leaving out each space', () => {
  const { bottom, top } = creditRim()

  expect(marks.rim).toHaveLength(top.length + bottom.replaceAll(' ', '').length)
  expect(rotations.slice(0, top.length).map((angle, index) => angle + rotations[top.length - 1 - index]!))
    .toEqual(Array.from(top, () => 0))
})

it('places a dot midway in each gap between the arcs, mirrored across the seal', () => {
  const [[x1, y1], [x2, y2]] = marks.gaps as [[number, number], [number, number]]

  expect(x1 + x2).toBeCloseTo(SEAL.center * 2, 1)
  expect(y1).toBe(y2)
})
