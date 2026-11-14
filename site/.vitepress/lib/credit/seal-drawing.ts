import { type VNode, h } from 'vue'

import { CONSTRUCTION } from '../logo/construction.ts'

/**
 * The colors the seal draws in, each a `--color-*` token of the theme.
 */
export type SealColor = 'accent' | 'forecast' | 'ink' | 'rule' | 'sky'

/**
 * The marks the seal draws that the faces and the forecast decide, its rim's
 * letters and the dots between its two arcs, and the forecast's rays and the
 * dots standing for a step with no sunlight.
 */
export interface SealMarks {
  calm : readonly (readonly [x: number, y: number])[]
  gaps : readonly (readonly [x: number, y: number])[]
  rays : readonly string[]
  rim  : readonly { d: string, transform: string }[]
}

/**
 * The seal's parts in pixels, where:
 *
 * - `core`, `edge`, and `hair` are its three rings, the core tinted by the
 *   accent at `opacity`.
 * - `rim` sets each letter at `size` pixels between the radii `inner` and
 *   `outer`, a letter every `step` degrees, the dot between the arcs `dot`
 *   pixels across.
 * - `rays` sets each step of the forecast `inner` pixels from the sun's center,
 *   the brightest `length` long, a step with no sunlight a dot `dot` across.
 * - `sun` is the half sun the rays spread from, on a horizon running from
 *   `horizon.from` to `horizon.to`.
 */
export const SEAL = {
  center  : 48,
  core    : { opacity: 0.07, r: 27, stroke: 0.8 },
  edge    : { r: 46, stroke: 1.2 },
  hair    : { r: 43.2, stroke: 0.6 },
  horizon : { from: 29, stroke: 0.8, to: 67 },
  rays    : { dot: 0.7, inner: 10.5, length: 12.5, stroke: 1.4 },
  rim     : { dot: 0.85, inner: 32.4, outer: 37.8, size: 7.4, step: 11.17 },
  size    : 96,
  sun     : { r: 8, stroke: 0.6, y: 56 }
}

/**
 * Draws the seal's marks in the colors `paint` gives, its sun clipped at the
 * horizon by the clip path `clip` names.
 */
export function sealDrawing(clip: string, marks: SealMarks, paint: (color: SealColor) => string): VNode[] {
  const { center, core, edge, hair, horizon, rays, rim, sun } = SEAL

  const ring = (r: number, stroke: string, width: number, fill = 'none', opacity?: number) =>
    h('circle', {
      cx             : center,
      cy             : center,
      fill           : fill,
      'fill-opacity' : opacity,
      r              : r,
      stroke         : stroke,
      'stroke-width' : width
    })
  const dot = ([x, y]: readonly [number, number], r: number, fill: string) =>
    h('circle', { cx: x, cy: y, fill, r })

  return [
    ring(edge.r, paint('accent'), edge.stroke),
    ring(hair.r, paint('rule'), hair.stroke),
    ring(core.r, paint('accent'), core.stroke, paint('accent'), core.opacity),
    ...marks.rim.map(({ d, transform }) => h('path', { d, fill: paint('ink'), transform })),
    ...marks.gaps.map((gap) => dot(gap, rim.dot, paint('ink'))),
    ...marks.calm.map((step) => dot(step, rays.dot, paint('forecast'))),
    ...marks.rays.map((d) => h('path', {
      d                : d,
      stroke           : paint('forecast'),
      'stroke-linecap' : 'round',
      'stroke-width'   : rays.stroke
    })),
    h('clipPath', { id: clip }, [h('rect', {
      height : sun.r * 2,
      width  : sun.r * 4,
      x      : center - sun.r * 2,
      y      : sun.y - sun.r * 2
    })]),
    h('circle', {
      'clip-path'    : `url(#${clip})`,
      cx             : center,
      cy             : sun.y,
      fill           : paint('sky'),
      r              : sun.r,
      stroke         : paint('ink'),
      'stroke-width' : sun.stroke
    }),
    h('path', {
      d                : `M${horizon.from} ${sun.y}H${horizon.to}`,
      stroke           : paint('ink'),
      'stroke-opacity' : CONSTRUCTION.horizon.opacity,
      'stroke-width'   : horizon.stroke
    })
  ]
}
