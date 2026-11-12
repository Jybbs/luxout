import { clamp }         from '@vueuse/core'
import { lerp }          from 'culori'
import { range }         from 'd3-array'
import { encode }        from 'fast-png'
import { type VNode, h } from 'vue'

import { type SampleDay, crossings } from '../daylight/sample-day.ts'
import { tenth }                     from '../daylight/tenth.ts'
import type { Logo }                 from '../logo/logo.ts'
import * as card                     from './card.ts'
import * as faces                    from './faces.ts'
import type { Palette }              from './palette.ts'
import { seeded }                    from './seeded.ts'
import * as sky                      from './sky.ts'

/**
 * One row of houses along a hillside, whose foot follows a sine of `amp` pixels
 * around `y`, its walls `dim` decades under the sky behind them.
 */
interface HouseRow {
  amp    : number
  dim    : number
  phase  : number
  scale  : number
  wave   : number
  y      : number
  front? : boolean
}

/**
 * What the site's card sets and where, with the address on a chip at the lower
 * left.
 */
const LAYOUT = {
  chip    : { baseline: 596, height: 56, width: 272, x: 18, y: 556 },
  logo    : { horizon: 164, left: 60, right: 660 },
  tagline : { baselines: [92, 144], right: 1140, size: 40 }
}
/**
 * The brightest lux a window's lamp comes on under, the level of a lit living
 * room.
 */
const LIVING                    = 50
const NAUTICAL                  = -12  // Degrees of altitude at which nautical twilight ends
const ROWS: readonly HouseRow[] = [
  { amp: 16, dim: 1.05, phase: 0.6, scale: 0.34, wave: 640, y: 378 },
  { amp: 18, dim: 1.5, phase: 2.1, scale: 0.46, wave: 520, y: 412 },
  { amp: 18, dim: 2.1, phase: 4, scale: 0.62, wave: 700, y: 452 },
  { amp: 16, dim: 2.8, phase: 1.2, scale: 0.86, wave: 560, y: 505 },
  { amp: 12, dim: 4.2, front: true, phase: 5.2, scale: 1.2, wave: 800, y: 570 }
]
const SKY_DEPTH           = 3.1     // Decades the sky falls from the horizon to the top of the card
const SKY_EASE            = 0.8     // The power of the height above the horizon that fall follows
const SKY_HORIZON         = 470     // The y of the horizon the sky's height is measured from, in pixels
const SUNSET              = -5 / 6  // Degrees of altitude at which the sun's upper edge meets the horizon
const TAGLINE: faces.Voice = { axes: { opsz: 32, wght: 400 }, face: 'serif' }
const WINDOW_LIGHT       = '#f6dc86'

/**
 * Writes the closed path through `points`.
 */
function closed(...points: card.Point[]): string {
  return `${points.map(([x, y], index) => `${index ? 'L' : 'M'}${tenth(x)} ${tenth(y)}`).join('')}Z`
}

/**
 * Draws one row's walls and roofs, each house's windows listed beside them.
 */
function houses(rand: () => number, { amp, phase, scale, wave, y }: HouseRow, behind?: readonly card.Box[]) {
  const base               = (x: number) => y + amp * Math.sin(x / wave * 2 * Math.PI + phase)
  const parts : string[]   = []
  const panes : card.Box[] = []
  let x                    = -40

  while (x < card.WIDTH + 40) {
    const width  = (70 + rand() * 62) * scale
    const floors = 2 + Math.floor(rand() * 2.2)
    const story  = 34 * scale
    const foot   = Math.max(base(x), base(x + width))
    const top    = foot - floors * story - 8 * scale
    const kind   = rand() * (scale > 1 ? 0.8 : 1)
    const pitch  = width * (0.34 + rand() * 0.2)
    const ground = foot + 200
    const east   = x + width
    const eave   = 3 * scale
    const cap    = top - 8 * scale
    const inset  = 10 * scale
    const deck   = top - 26 * scale

    const ridge: card.Point[] = kind < 0.62
                              ? [[x, top], [x + width / 2, top - pitch], [east, top]]
                              : kind < 0.82
                              ? [[x, top], [x + inset, deck], [east - inset, deck], [east, top]]
                              : [[x - eave, top], [x - eave, cap], [east + eave, cap], [east + eave, top]]

    parts.push(closed([x, ground], ...ridge, [east, ground]))

    if (rand() < 0.5 && kind < 0.82) {
      const stack = x + width * (0.18 + rand() * 0.2)
      const crown = top - pitch * 0.9
      const wide  = stack + 9 * scale

      parts.push(closed([stack, top], [stack, crown], [wide, crown], [wide, top]))
    }

    const cols = width > 96 * scale ? 3 : 2

    for (const floor of range(floors)) {
      for (const col of range(cols)) {
        panes.push({
          height : 18 * scale,
          width  : 12 * scale,
          x      : x + width * (col + 0.5) / cols - 6 * scale,
          y      : top + 8 * scale + floor * story
        })
      }
    }

    const gap = rand() < 0.3 ? 8 * scale : 0

    if (gap && behind) {
      const blocking = behind.filter((pane) => pane.x < east + gap && pane.x + pane.width > east)
      const sill     = Math.max(top, ...blocking.map((pane) => pane.y + pane.height))

      parts.push(closed([east, ground], [east, sill], [east + gap, sill], [east + gap, ground]))
    }

    x += width + gap
  }

  return { d: parts.join(''), panes }
}

/**
 * Draws the site's card, a hillside town over the evening of the sample day
 * read across the card from sunset to past nautical twilight, the sky and every
 * lamp taking the reading at their place along it.
 */
export function hillCard(day: SampleDay, fonts: faces.Faces, logo: Logo, palette: Palette): card.Card {
  const { ground, ink, sun } = palette

  const drawing   = new card.Card(fonts, ground)
  const from      = crossings(day.altitudes, SUNSET)[1] + 1
  const to        = crossings(day.altitudes, NAUTICAL)[1] + 8
  const readingAt = (x: number) => {
    const minute = lerp(from, to, clamp(x / card.WIDTH, 0, 1))
    const whole  = Math.floor(minute)

    return 10 ** lerp(Math.log10(day.readings[whole]!), Math.log10(day.readings[whole + 1]!), minute - whole)
  }
  const skyFall = (y: number) => 10 ** (-SKY_DEPTH * clamp(1 - y / SKY_HORIZON, 0, 1) ** SKY_EASE)
  const pixels  = new Uint8Array(card.WIDTH * card.HEIGHT * 3)

  for (const y of range(card.HEIGHT)) {
    for (const x of range(card.WIDTH)) {
      pixels.set(sky.channelsAt(readingAt(x) * skyFall(y)), (y * card.WIDTH + x) * 3)
    }
  }

  const raster = encode({ channels: 3, data: pixels, depth: 8, height: card.HEIGHT, width: card.WIDTH })

  drawing.add(h('image', {
    height : card.HEIGHT,
    href   : `data:image/png;base64,${Buffer.from(raster).toString('base64')}`,
    width  : card.WIDTH
  }))

  const star = seeded(41)

  drawing.add(...range(300).flatMap(() => {
    const x     = star() * card.WIDTH
    const y     = star() ** 1.3 * 340
    const size  = 0.6 + star()
    const shine = 0.3 + star() * 0.6

    return readingAt(x) * skyFall(y) < 0.02 * 10 ** (star() * 0.8)
         ? [h('circle', { cx: tenth(x), cy: tenth(y), fill: ink, opacity: shine, r: tenth(size) })]
         : []
  }))

  const rand                     = seeded(77)
  let shown: readonly card.Box[] = []

  for (const row of ROWS) {
    const { d, panes }       = houses(rand, row, row.front ? shown : undefined)
    const lit   : card.Box[] = []
    const lamps : VNode[]    = []
    const glows : VNode[]    = []
    const dark  : VNode[]    = []

    drawing.add(h('path', {
      d,
      fill: drawing.across(20, (share) => sky.colorAt(readingAt(share * card.WIDTH) * 10 ** -row.dim))
    }))

    for (const pane of panes) {
      const level = 10 ** lerp(Math.log10(LIVING), -1.2, rand())
      const never = rand() < 0.12

      if (!never && readingAt(pane.x + pane.width / 2) < level) {
        const fill = sky.mix(WINDOW_LIGHT, sun, rand())

        lamps.push(card.rect(pane, { fill }))
        glows.push(card.rect({
          height : pane.height * 1.6,
          width  : pane.width * 1.8,
          x      : pane.x - pane.width * 0.4,
          y      : pane.y - pane.height * 0.3
        }, { fill }))
        lit.push(pane)
      } else {
        dark.push(card.rect(pane, { fill: sky.colorAt(readingAt(pane.x) * 10 ** -(row.dim + 0.4)) }))
      }
    }

    drawing.add(...dark, drawing.blurred(3 + row.scale * 7, 0.55, glows), ...lamps)
    shown = lit
  }

  const { chip, logo: place, tagline } = LAYOUT

  drawing.add(logo.titleAcross(place.left, place.right, 'dark', place.horizon))

  for (const [index, line] of ['An outdoor light sensor', 'for Apple Home.'].entries()) {
    drawing.say(line, TAGLINE, {
      anchor : 'end',
      fill   : ink,
      size   : tagline.size,
      x      : tagline.right,
      y      : tagline.baselines[index]!
    })
  }

  const radius = chip.height / 2

  drawing.add(
    drawing.blurred(11.4, 0.55, [card.rect(card.around(chip, 3), { fill: sun, rx: radius + 3 })]),
    card.rect(chip, { fill: sun, rx: radius })
  )
  drawing.say(card.ADDRESS, faces.MONO, {
    anchor : 'middle',
    fill   : ground,
    size   : 40,
    x      : chip.x + chip.width / 2,
    y      : chip.baseline
  })

  return drawing
}
