import { wcagContrast } from 'culori'
import { expect, it }   from 'vitest'

import { readPalette } from '../../../../site/.vitepress/lib/cards/palette.ts'
import * as sky        from '../../../../site/.vitepress/lib/cards/sky.ts'
import { luxRange }    from '../../../../site/.vitepress/lib/daylight/homekit.ts'
import { vitepress }   from '../../common/paths.ts'

const palette = await readPalette(vitepress)

it('reads the sky’s two ends at the two ends of HomeKit’s range', () => {
  expect([luxRange.min, luxRange.max, 0].map(sky.colorAt)).toEqual(['#1b1d31', '#f6e7a6', '#1b1d31'])
  expect(sky.channelsAt(luxRange.max)).toEqual([246, 231, 166])
})

it('moves a hue toward the ink until it holds the ratio', () => {
  const held = sky.holding(palette.ground, '#55497f', 4.8, palette.ink)

  expect(wcagContrast(held, palette.ground)).toBeGreaterThanOrEqual(4.8)
  expect(sky.holding('#000000', '#000000', 30, palette.ink)).toBe(palette.ink)
  expect(sky.mix('#000000', '#ffffff', 0)).toBe('#000000')
})
