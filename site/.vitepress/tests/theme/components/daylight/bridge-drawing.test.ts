/** @vitest-environment happy-dom */
import { expect } from 'vitest'

import { bridgeDrawing, dropAt } from '../../../../theme/components/daylight/bridge-drawing.ts'
import { data }                  from '../../../common/data/twilight-bridge.ts'
import { test }                  from '../../../common/mount.ts'

const { cut, height, rest, width, x, y } = data

test('draws in the units of its data', ({ mount }) => {
  const svg = mount(() => bridgeDrawing(data)).querySelector('svg')!

  expect(svg.getAttribute('viewBox')).toBe(`0 0 ${width} ${height}`)
})

test('washes the span from the left edge to the cutoff, and ends the cut on the curve', ({ mount }) => {
  const svg = mount(() => bridgeDrawing(data)).querySelector('svg')!

  expect(svg.querySelector('.twilight-bridge-wash')!.getAttribute('width')).toBe(String(x[cut]))
  expect(svg.querySelector('.twilight-bridge-roof')!.getAttribute('d')).toBe(`M0 0H${x[cut]}`)
  expect(svg.querySelector('.twilight-bridge-cut')!.getAttribute('d')).toBe(`M${x[cut]} 0V${y[cut]}`)
})

test('draws the curve as a fill beneath an ink edge, the edge over the fill', ({ mount }) => {
  const svg  = mount(() => bridgeDrawing(data)).querySelector('svg')!
  const sky  = svg.querySelector('.twilight-bridge-sky')!
  const edge = svg.querySelector('.twilight-bridge-edge')!

  expect(sky.getAttribute('d')).toBe(data.area)
  expect(edge.getAttribute('d')).toBe(data.edge)
  expect(sky.compareDocumentPosition(edge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('marks the minor ticks apart, so a narrow plot can drop them', ({ mount }) => {
  const svg = mount(() => bridgeDrawing(data)).querySelector('svg')!

  expect(svg.querySelector('.twilight-bridge-minor')!.getAttribute('d')).toBe(data.minor)
})

test('drops the sun’s line to the floor from the resting stop', ({ mount }) => {
  const svg = mount(() => bridgeDrawing(data)).querySelector('svg')!

  expect(svg.querySelector('.twilight-bridge-drop')!.getAttribute('d')).toBe(dropAt(data, rest))
  expect(dropAt(data, rest)).toBe(`M${x[rest]} ${y[rest]}V${height}`)
})
