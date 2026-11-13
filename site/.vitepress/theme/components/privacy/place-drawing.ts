import { type VNode, h } from 'vue'

import type { RoundedPlace }      from '../../../lib/privacy/rounded-place.ts'
import { plotDrawing, plotWords } from '../../controls/plot-marks.ts'

const word = plotWords('rounded-place-word')

/**
 * Draws one forecast cell tiled by the areas that round to each pair of
 * coordinates, the area holding the stored pair filled, the pair ringed and
 * dotted at the area's center, and the cell's width beneath it.
 */
export function placeDrawing(layout: RoundedPlace): VNode {
  const { area, cell, dim, height, label, pair, place, scale, tiles, width } = layout

  return plotDrawing('rounded-place-drawing', label, width, height, [
    h('rect', { class: 'rounded-place-cell', ...cell }),
    ...tiles.map((tile) => h('rect', { class: 'rounded-place-tile', ...tile })),
    h('path', { class: 'rounded-place-dim', d: dim }),
    h('rect', { class: 'rounded-place-area', ...area }),
    h('circle', { class: 'rounded-place-dot', cx: pair[0], cy: pair[1], r: 3.5 }),
    h('circle', { class: 'rounded-place-ring', cx: place[0], cy: place[1], r: 5 }),
    word(scale.word, scale.x, scale.y, { anchor: 'middle' })
  ])
}
