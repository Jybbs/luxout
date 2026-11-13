import { type VNode, h } from 'vue'

import type { Faces, Voice } from '../cards/faces.ts'
import type { Palette }      from '../cards/palette.ts'
import { tenth }             from '../daylight/tenth.ts'

export type Badge = (typeof BADGES)[number]

/**
 * Lists the badges the README's row pairs a label with, each named as its file
 * under `site/public/badges/`.
 */
export const BADGES  = ['npm', 'node', 'docs'] as const
const HEIGHT         = 28    // The pixels Shields draws a `for-the-badge` badge tall
const PAD            = 12    // The pixels either side of the word
const SIZE           = 11    // The pixels to the em
const SVG            = 'http://www.w3.org/2000/svg'
const VOICE: Voice   = { axes: { wght: 600 }, face: 'mono', track: 1.25 }

/**
 * Draws the label of one badge, its name in capitals in JetBrains Mono on the
 * dark ground, at the height of the Shields value it sits beside.
 */
export function badgeLabel(faces: Faces, { ground, ink }: Palette, badge: Badge): VNode {
  const word     = badge.toUpperCase()
  const setting  = faces.set(VOICE, SIZE, word)
  const width    = Math.round(setting.width + 2 * PAD)
  const baseline = HEIGHT / 2 + (setting.ink.top + setting.ink.bottom) / 2

  return h(
    'svg',
    {
      'aria-label' : word,
      height       : HEIGHT,
      role         : 'img',
      viewBox      : `0 0 ${width} ${HEIGHT}`,
      width        : width,
      xmlns        : SVG
    },
    [
      h('rect', { fill: ground, height: HEIGHT, width }),
      h('path', { d: setting.d, fill: ink, transform: setting.transformAt(PAD, tenth(baseline)) })
    ]
  )
}
