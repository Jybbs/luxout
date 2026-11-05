import { type VNode, h } from 'vue'

import type * as gap              from '../../../lib/daylight/gap.ts'
import { tenth }                  from '../../../lib/daylight/tenth.ts'
import { plotDrawing, plotWords } from '../../controls/plot-marks.ts'

const CHIP_CHARACTER = 7.1  // Width of one letter of a chip's label, in the drawing's units
const CHIP_PADDING   = 18
const word           = plotWords('the-gap-word')

function clockWords({ height, left, right, x }: gap.GapLayout, { minutes, noon, span }: gap.Gap): VNode[] {
  const y = height - 8

  return [
    word(span[0], left, y),
    word(minutes[noon]!.clock, x[noon]!, y, { anchor: 'middle' }),
    word(span[1], right, y, { anchor: 'end' })
  ]
}

function lane(
  { big, left, levelX, right }        : gap.GapLayout,
  { bottom, chip, rings, spans, top } : gap.GapLane,
  { name, switches, unit }            : gap.GapSensor
): VNode[] {
  const height = bottom - top
  const middle = (top + bottom) / 2

  return [
    h('path', { class: 'the-gap-off', d: `M${left} ${bottom}H${right}` }),
    ...spans.map(({ width, x }) => h('rect', { class: 'the-gap-on', height, width, x, y: top })),
    ...rings.map((cx) => h('circle', { class: 'the-gap-ring', cx, cy: middle, r: 4.5 })),
    h('rect', {
      class  : 'the-gap-chip',
      height : 18,
      rx     : 9,
      width  : tenth(name.length * CHIP_CHARACTER + CHIP_PADDING),
      x      : left,
      y      : chip - 9
    }),
    word(name, left + CHIP_PADDING / 2, chip, { name: 'the-gap-chip-name' }),
    word('on', left - 8, top + 4, { anchor: 'end' }),
    word('off', left - 8, bottom - 4, { anchor: 'end' }),
    word(switches, levelX, middle - 2, { name: 'the-gap-count', size: big }),
    word(unit, levelX, middle - 2 + big * 0.75 + 10)
  ]
}

/**
 * Draws the reading over the gap with the two sensors as lanes on one clock,
 * each switch ringed and each lane's count set large at its end, at the
 * coordinates of `layout`, with `cursor` drawn last.
 */
export function gapDrawing(layout: gap.GapLayout, sample: gap.Gap, ...cursor: readonly VNode[]): VNode {
  const { height, left, levelX, offY, onY, path, right, ties, width } = layout

  const { offBelow, onAt } = sample.sensors[1]
  const label              = [sample.label, ...sample.sensors.map((sensor) => sensor.label)].join('. ')

  return plotDrawing('the-gap-drawing', label, width, height, [
    h('rect', {
      class  : 'the-gap-band',
      height : tenth(offY - onY),
      width  : tenth(right - left),
      x      : left,
      y      : onY
    }),
    ...[offY, onY].map((level) => h('path', { class: 'the-gap-edge', d: `M${left} ${level}H${right}` })),
    ...ties.map((d) => h('path', { class: 'the-gap-tie', d })),
    h('path', { class: 'the-gap-halo', d: path }),
    h('path', { class: 'the-gap-reading', d: path }),
    word(onAt, levelX, onY, { name: 'the-gap-figure' }),
    word('gap', levelX, (onY + offY) / 2),
    word(offBelow, levelX, offY, { name: 'the-gap-figure' }),
    ...sample.sensors.flatMap((sensor, index) => lane(layout, layout.lanes[index]!, sensor)),
    ...clockWords(layout, sample),
    ...cursor
  ])
}
