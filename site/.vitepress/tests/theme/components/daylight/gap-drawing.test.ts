/** @vitest-environment happy-dom */
import { sum }    from 'd3-array'
import { expect } from 'vitest'
import { h }      from 'vue'

import { gapDrawing } from '../../../../theme/components/daylight/gap-drawing.ts'
import { data }       from '../../../common/data/daylight.ts'
import { test }       from '../../../common/mount.ts'

const { gap } = data

test.for(gap.layouts)('draws a lane with its count at the $width layout', (layout, { mount }) => {
  const svg   = mount(() => gapDrawing(layout, gap)).querySelector('svg')!
  const rings = sum(gap.sensors, ({ switches }) => switches)

  expect(svg.getAttribute('viewBox')).toBe(`0 0 ${layout.width} ${layout.height}`)
  expect(svg.querySelectorAll('.the-gap-ring')).toHaveLength(rings)
  expect([...svg.querySelectorAll('.the-gap-count')].map(({ textContent }) => textContent))
    .toEqual(gap.sensors.map(({ switches }) => String(switches)))
})

test('says in its label what the drawing and each lane show', ({ mount }) => {
  const svg    = mount(() => gapDrawing(gap.layouts[0]!, gap)).querySelector('svg')!
  const labels = gap.sensors.map(({ label }) => label)

  expect(svg.getAttribute('aria-label')).toBe([gap.label, ...labels].join('. '))
})

test('draws the cursor last, over everything else', ({ mount }) => {
  const svg = mount(() => gapDrawing(gap.layouts[0]!, gap, h('g', { class: 'cursor' }))).querySelector('svg')!

  expect(svg.lastElementChild!.getAttribute('class')).toBe('cursor')
})
