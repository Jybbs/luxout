/** @vitest-environment happy-dom */
import { expect } from 'vitest'

import * as dialLens   from '../../../../lib/daylight/dial-lens.ts'
import { dialDrawing } from '../../../../theme/components/daylight/dial-drawing.tsx'
import { data }        from '../../../common/data/day-dial.ts'
import { test }        from '../../../common/mount.ts'

const plot = new dialLens.DialPlot(data.marks)
const rest = dialLens.HALVES.map((half) => plot.paths(half, 0))

test('draws the dial in its own coordinates, with the label naming what it shows', ({ mount }) => {
  const svg = mount(() => dialDrawing(data, rest, data.opens)).querySelector('svg')!

  expect(svg.getAttribute('viewBox')).toBe(`0 0 ${dialLens.DIAL.width} ${dialLens.DIAL.height}`)
  expect(svg.getAttribute('aria-label')).toBe(data.label)
})

test.for(dialLens.HALVES)(
  'writes every path of half %i once, in the order `DialPlot.paths` lists them',
  (half, { mount }) => {
    const svg = mount(() => dialDrawing(data, rest, data.opens)).querySelector('svg')!

    expect([...svg.querySelectorAll(`[data-half='${half}']`)].map((path) => path.getAttribute('d') ?? ''))
      .toEqual(rest[half])
  }
)

test('draws one layer per stretch, the selected one lit and the peeked one marked', ({ mount }) => {
  const svg    = mount(() => dialDrawing(data, rest, 1, 2)).querySelector('svg')!
  const groups = [...svg.querySelectorAll('.day-estimate-layer')]

  expect(groups).toHaveLength(data.stretches.length)
  expect(groups.map((group) => group.hasAttribute('data-on'))).toEqual([false, true, false, false, false])
  expect(groups.map((group) => group.hasAttribute('data-peek'))).toEqual([false, false, true, false, false])
})

test('marks no layer peeked unless a peek is named', ({ mount }) => {
  const svg = mount(() => dialDrawing(data, rest, 0)).querySelector('svg')!

  expect(svg.querySelector('[data-peek]')).toBeNull()
})
