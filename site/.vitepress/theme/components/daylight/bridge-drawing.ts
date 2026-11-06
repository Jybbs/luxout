import { type VNode, h } from 'vue'

import type { TwilightBridge } from '../../../lib/daylight/twilight-bridge.ts'
import { plotMarks }           from '../../controls/plot-marks.ts'

/**
 * Draws the marks of The Twilight Bridge, the clear-sky curve as a fill beneath
 * an ink edge and the span up to the cutoff washed under it, stretched across
 * the `viewBox`, with the sun's drop line at the resting stop.
 */
export function bridgeDrawing(sample: TwilightBridge): VNode {
  const { area, axis, cut, edge, grid, height, minor, rest, width, x, y } = sample

  const cutX = x[cut]!

  return plotMarks('twilight-bridge-marks', width, height, [
    h('rect', { class: 'twilight-bridge-wash', height, width: cutX }),
    h('path', { class: 'twilight-bridge-sky', d: area }),
    h('path', { class: 'twilight-bridge-grid', d: grid }),
    h('path', { class: 'twilight-bridge-axis', d: axis }),
    h('path', { class: 'twilight-bridge-axis twilight-bridge-minor', d: minor }),
    h('path', { class: 'twilight-bridge-roof', d: `M0 0H${cutX}` }),
    h('path', { class: 'twilight-bridge-cut', d: `M${cutX} 0V${y[cut]}` }),
    h('path', { class: 'twilight-bridge-edge', d: edge }),
    h('path', { class: 'twilight-bridge-drop', d: dropAt(sample, rest) })
  ])
}

/**
 * Writes the line that drops from the sun at `stop` to the floor of the
 * drawing.
 */
export function dropAt({ height, x, y }: TwilightBridge, stop: number): string {
  return `M${x[stop]} ${y[stop]}V${height}`
}
