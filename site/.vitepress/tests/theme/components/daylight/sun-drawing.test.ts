/** @vitest-environment happy-dom */
import { expect } from 'vitest'
import { h }      from 'vue'

import { formatClock } from '../../../../lib/daylight/format.ts'
import { SUN_LAYOUTS } from '../../../../lib/daylight/sun-curve.ts'
import { sunDrawing }  from '../../../../theme/components/daylight/sun-drawing.ts'
import { data }        from '../../../common/data/sun-year.ts'
import { test }        from '../../../common/mount.ts'

const [narrow, wide] = SUN_LAYOUTS

test.for(SUN_LAYOUTS)('draws the $width layout at its own coordinates', (layout, { mount }) => {
  const svg = mount(() => sunDrawing(layout, data, 'glow')).querySelector('svg')!

  expect(svg.getAttribute('viewBox')).toBe(`0 0 ${layout.width} ${layout.height}`)
  expect(svg.querySelector('.sun-path-horizon')!.getAttribute('d')).toBe(
    `M0 ${layout.horizon}H${layout.width}`
  )
})

test('draws a hairline per curve the year keeps, the months dashed apart', ({ mount }) => {
  const svg = mount(() => sunDrawing(wide, data, 'glow')).querySelector('svg')!

  expect(svg.querySelectorAll('.sun-path-hair')).toHaveLength(data.marks.length)
  expect(svg.querySelectorAll('.sun-path-month')).toHaveLength(
    data.marks.filter(({ named }) => !named).length
  )
})

test('places the sun at the resting minute and fills it from the glow it is given', ({ mount }) => {
  const svg = mount(() => sunDrawing(narrow, data, 'glow')).querySelector('svg')!

  expect(svg.querySelector('.sun-path-cursor')!.getAttribute('transform'))
    .toBe(narrow.moveAcross(data.rest))
  expect(svg.querySelector('.sun-path-height')!.getAttribute('transform'))
    .toBe(narrow.moveUp(data.minutes[data.rest]!))
  expect(svg.querySelector('radialGradient')!.id).toBe('glow')
  expect(svg.querySelector('[fill="url(#glow)"]')).not.toBeNull()
})

test('draws the cursor it is given last', ({ mount }) => {
  const svg = mount(() => sunDrawing(wide, data, 'glow', h('g', { class: 'cursor' }))).querySelector('svg')!

  expect(svg.lastElementChild!.getAttribute('class')).toBe('cursor')
})

test('names the sample day, its sunrise, its top, and its sunset in the label', ({ mount }) => {
  const svg   = mount(() => sunDrawing(wide, data, 'glow')).querySelector('svg')!
  const label = svg.getAttribute('aria-label')

  const { rise, set } = data.days[data.sample]!

  expect(label).toContain(data.lede.opening)
  expect(label).toContain(`rising over the horizon at ${formatClock(rise)}`)
  expect(label).toContain(`${data.lede.height} at ${data.lede.clock}`)
  expect(label).toContain(`setting at ${formatClock(set)}`)
})
