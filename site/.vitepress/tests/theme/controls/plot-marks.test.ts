import { expect, it } from 'vitest'
import { h }          from 'vue'

import { plotDrawing, plotMarks, plotWords } from '../../../theme/controls/plot-marks.tsx'

it('stretches the marks across their element and hides them from the accessibility tree', () => {
  const child                     = h('rect')
  const { children, props, type } = plotMarks('some-marks', 300, 40, [child])

  expect(type).toBe('svg')
  expect(props).toEqual({
    'aria-hidden'       : true,
    class               : 'some-marks',
    preserveAspectRatio : 'none',
    viewBox             : '0 0 300 40'
  })
  expect(children).toEqual([child])
})

it('draws one labeled image holding the namespace a frame file needs', () => {
  const child                     = h('rect')
  const { children, props, type } = plotDrawing('some-drawing', 'A plot', 300, 40, [child])

  expect(type).toBe('svg')
  expect(props).toEqual({
    'aria-label' : 'A plot',
    class        : 'some-drawing',
    role         : 'img',
    viewBox      : '0 0 300 40',
    xmlns        : 'http://www.w3.org/2000/svg'
  })
  expect(children).toEqual([child])
})

it('writes a word centered on its row in the plain class, at a tenth of a unit', () => {
  const { children, props, type } = plotWords('some-word')('lux', 4, 8.04)

  expect(type).toBe('text')
  expect(children).toEqual(['lux'])
  expect(props).toEqual({
    class               : 'some-word',
    'dominant-baseline' : 'central',
    'font-size'         : undefined,
    'text-anchor'       : undefined,
    x                   : 4,
    y                   : 8
  })
})

it('writes a word in the class, the anchor, and the size its style names', () => {
  const style = { anchor: 'end', name: 'a-figure', size: 30 } as const

  expect(plotWords('some-word')(12, 4, 8, style).props).toMatchObject({
    class         : 'a-figure',
    'font-size'   : 30,
    'text-anchor' : 'end'
  })
})
