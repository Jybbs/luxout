import { type VNode, h } from 'vue'

import * as clock                 from '../../../lib/daylight/clock.ts'
import { formatClock }            from '../../../lib/daylight/format.ts'
import * as curve                 from '../../../lib/daylight/sun-curve.ts'
import type { SunYear }           from '../../../lib/daylight/sun-year.ts'
import { plotDrawing, plotWords } from '../../controls/plot-marks.ts'

const FIGURE     = { anchor: 'middle', name: 'sun-path-figure' } as const
const GRID_LINES = [30, 60, 90]  // Degrees
const word       = plotWords('sun-path-word')

function dayMarks(layout: curve.SunLayout, day: curve.SunDay): VNode[] {
  const { horizon } = layout
  const crossing    = (name: string, minute: number, label: string) =>
    h('g', { class: `sun-path-${name}`, transform: layout.moveAcross(minute) }, [
      h('circle', { class: 'sun-path-crossing', cy: horizon, r: 3.5 }),
      word(`${label} ${formatClock(minute)}`, 0, horizon + 13, FIGURE)
    ])

  return [
    crossing('rise', day.rise, 'Sunrise'),
    crossing('set', day.set, 'Sunset'),
    h('circle', { class: 'sun-path-crossing sun-path-top', r: 3.5, transform: layout.moveTo(day) }),
    h('g', { class: 'sun-path-peak', transform: layout.moveOver(day) }, [
      word(curve.peakWord(day), 0, 0, FIGURE)
    ])
  ]
}

function plotLabel({ days, lede, sample }: SunYear): string {
  const day = days[sample]!

  return `The sun’s height through ${lede.opening} as one curve across the clock, rising over the horizon at `
       + `${formatClock(day.rise)}, highest at ${lede.height} at ${lede.clock}, and setting at `
       + `${formatClock(day.set)}, with a slider across the year that draws the chosen day as the one `
       + 'heavy line with the sky beneath it washed, every other curve a hairline.'
}

function words(layout: curve.SunLayout): VNode[] {
  const { height, horizon, left, right } = layout

  return [
    ...GRID_LINES.map((altitude) => word(`${altitude}°`, left - 5, layout.yOf(altitude), { anchor: 'end' })),
    word('Straight overhead', right, layout.yOf(90) - 10, { anchor: 'end' }),
    word('Horizon', left, horizon - 10),
    ...clock.HOUR_MARKS.map((hour) =>
      word(clock.hourWord(hour), layout.xOf(hour * 60), height - 8, { anchor: 'middle' })
    )
  ]
}

/**
 * Draws the sun's path through the sample day as one curve over the horizon,
 * the year's curves beneath it, at the coordinates of `layout`, with `cursor`
 * drawn above the ground.
 */
export function sunDrawing(
  layout    : curve.SunLayout,
  sample    : SunYear,
  glow      : string,
  ...cursor : readonly VNode[]
): VNode {
  const { height, horizon, left, right, top, width } = layout

  const day     = sample.days[sample.sample]!
  const path    = curve.sunCurve(day)
  const degrees = {
    height              : horizon - top,
    preserveAspectRatio : 'none',
    viewBox             : `0 -90 ${clock.DAY_MINUTES} 90`,
    width               : right - left,
    x                   : left,
    y                   : top
  }

  return plotDrawing('sun-path-drawing', plotLabel(sample), width, height, [
    h('defs', h('radialGradient', { id: glow }, [
      h('stop', { class: 'sun-path-glow-inner', offset: '0.35' }),
      h('stop', { class: 'sun-path-glow-outer', offset: '1' })
    ])),
    h('path', {
      class : 'sun-path-grid',
      d     : GRID_LINES.map((altitude) => `M${left} ${layout.yOf(altitude)}H${right}`).join('')
    }),
    h('svg', { ...degrees, class: 'sun-path-year' }, [
      h('path', { class: 'sun-path-wash', d: path }),
      ...sample.marks.map((mark) => h('path', {
        class : ['sun-path-hair', { 'sun-path-month': !mark.named }],
        d     : curve.sunCurve(sample.days[mark.day]!)
      }))
    ]),
    h('svg', degrees, h('path', { class: 'sun-path-curve', d: path })),
    h('g', { class: 'sun-path-cursor', transform: layout.moveAcross(sample.rest) }, [
      h('g', { class: 'sun-path-height', transform: layout.moveUp(sample.minutes[sample.rest]!) }, [
        h('circle', { fill: `url(#${glow})`, r: layout.glow }),
        h('circle', { class: 'sun-path-sun', r: layout.disc })
      ])
    ]),
    h('rect', { class: 'sun-path-ground', height: height - horizon, width, y: horizon }),
    h('path', { class: 'sun-path-horizon', d: `M0 ${horizon}H${width}` }),
    ...dayMarks(layout, day),
    ...words(layout),
    ...cursor
  ])
}
