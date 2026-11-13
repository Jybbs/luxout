import type { VNode } from 'vue'

import type { DayDial } from '../../../lib/daylight/day-dial.ts'
import { DIAL }         from '../../../lib/daylight/dial-lens.ts'
import { plotDrawing }  from '../../controls/plot-marks.tsx'

function pair(rest: readonly (readonly string[])[], name: string, place: number): VNode[] {
  return rest.map((paths, half) => (
    <path class={`day-estimate-${name}`} d={paths[place] || undefined} data-half={half} />
  ))
}

/**
 * Draws the day around the dial from the paths of each half of the clock, read
 * in the order `DialPlot.paths` writes them, with the bracket and the reading
 * of the stretch at `selected` lit and the bracket of the stretch at `peek`
 * drawn.
 */
export function dialDrawing(
  sample   : DayDial,
  rest     : readonly (readonly string[])[],
  selected : number,
  peek     : number = -1
): VNode {
  const { center, floor, height, rim, width } = DIAL

  let place  = 0
  const next = (name: string) => pair(rest, name, place++)

  return plotDrawing('day-estimate-drawing', sample.label, width, height, [
    ...sample.marks.washes.flatMap((_, depth) => next(`wash-${depth}`)),
    ...next('sky'),
    ...next('edge'),
    <circle class="day-estimate-rim" cx={center.x} cy={center.y} r={rim} />,
    <circle class="day-estimate-floor" cx={center.x} cy={center.y} r={floor} />,
    ...next('quiet'),
    ...next('cover'),
    ...next('fall'),
    ...sample.stretches.map((_, index) => (
      <g
        class="day-estimate-layer"
        data-on={index === selected || undefined}
        data-peek={index === peek || undefined}
      >
        {...next('bracket')}
        {...next('line')}
      </g>
    )),
    ...next('tick')
  ])
}
