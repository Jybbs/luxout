import { wcagContrast } from 'culori'
import { range, sort }  from 'd3-array'
import { expect, it }   from 'vitest'

import { luxRange } from '../../../lib/daylight/homekit.ts'
import { skyShade } from '../../../lib/daylight/sky-ramp.ts'

const decades   = Math.log10(luxRange.max / luxRange.min)
const positions = range(decades).map((index) => (index + 0.5) / decades)

it('brightens from the floor to the ceiling', () => {
  const contrast = positions.map((position) => wcagContrast(skyShade(position).fill, '#000000'))

  expect(contrast).toEqual(sort(contrast))
})

it.each(positions)('sets ink holding 4.5:1 on the shade at position %f', (position) => {
  const { fill, ink } = skyShade(position)

  expect(wcagContrast(fill, ink)).toBeGreaterThanOrEqual(4.5)
})
