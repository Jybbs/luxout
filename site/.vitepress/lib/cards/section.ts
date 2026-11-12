import { lerp, unlerp, wcagContrast }    from 'culori'
import { greatest, least, pairs, range } from 'd3-array'
import { h }                             from 'vue'

import { formatLux, signed } from '../daylight/format.ts'
import type { SampleDay }    from '../daylight/sample-day.ts'
import { tenth }             from '../daylight/tenth.ts'
import * as card             from './card.ts'
import * as faces            from './faces.ts'
import type { Palette }      from './palette.ts'
import { Room, travelOf }    from './room.ts'
import * as sky              from './sky.ts'

/**
 * The page a section's card names, and its section's position among the site's.
 */
interface Sheet {
  count : number
  index : number
  label : string
  title : string
}

const BASE                = 564  // The baseline of the reading, in pixels
const CAPS: faces.Voice   = { axes: { wght: 500 }, face: 'mono', track: 3 }
const DIRECT              = 12  // The altitude in degrees above which the sun casts on the floor
const FIGURE: faces.Voice = { axes: { opsz: 24, wght: 800 }, face: 'display' }
/**
 * Lists the minute past midnight each section's card shows, in the sections'
 * reading order, one for each pane of the window.
 */
export const HOURS       = [393, 401, 450, 720, 1088, 1120]
const LEFT               = 72  // The left edge of the words, in pixels
const RING               = 86  // The radius in pixels the rings around the window grow from
const ROMAN: faces.Voice = { axes: { opsz: 36, wght: 600 }, face: 'display' }
const STRIP              = { from: 300, to: 1200, top: 606 }  // The day bar's minutes and its top in pixels
const TITLE              = { lead: 86, room: 640, size: 80, y: 150 }
const WORD_GAP           = 22  // The gap in pixels between the reading and its unit
/**
 * Where the line naming the section sets its capitals, right of the short rule
 * that opens it.
 */
const PLACE = { baseline: 66, left: LEFT + 60, size: 30 }

/**
 * Breaks `title` into the fewest lines up to three whose widest line fits
 * `TITLE.room`, choosing the break that leaves the lines closest in width.
 */
function wrapped(fonts: faces.Faces, title: string): string[] {
  const words  = title.split(' ')
  const widest = (lines: readonly string[]) =>
    Math.max(...lines.map((line) => fonts.set(ROMAN, TITLE.size, line).width))
  const joined = (...breaks: number[]) => pairs([0, ...breaks, words.length])
    .map(([from, to]) => words.slice(from, to).join(' '))
  const cuts   = range(1, words.length)
  const counts = [
    [joined()],
    cuts.map((cut) => joined(cut)),
    cuts.flatMap((first) => range(first + 1, words.length).map((second) => joined(first, second)))
  ].filter((options) => options.length)
  const fits = counts.find((options) => options.some((option) => widest(option) <= TITLE.room))

  return least(fits ?? counts.at(-1)!, widest)!
}

/**
 * Draws a section's card, a window lit at the section's hour of the sample day
 * on one neutral ground, the pane, its cast, and the day bar all in the sky's
 * color at that hour's reading.
 */
export function sectionCard(
  day                            : SampleDay,
  fonts                          : faces.Faces,
  palette                        : Palette,
  { count, index, label, title } : Sheet
): card.Card {
  const { ground, ink, muted } = palette

  const minute  = HOURS[index]!
  const lux     = day.readings[minute]!
  const color   = sky.colorAt(lux)
  const drawing = new card.Card(fonts, ground)
  const room    = new Room(drawing, ground, ink)
  const pane    = room.pane(index)
  const sun     = day.altitudes[minute]!
  const direct  = sun > DIRECT
  const cast    = room.cast(pane, direct ? travelOf(sun, day.azimuth(minute)) : room.under(pane))
  const painted = room.shell(0.024, 0.05)
  const place   = `${label} · ${index + 1} of ${count}`.toUpperCase()
  const lines   = sky.mix(ground, ink, 0.34)
  const flat    = room.flatPane(index)
  const spread  = (step: number) => RING * (2 ** (step / 2) - 1)
  const steps   = range(1, 10)
  const middle  = flat.x + flat.width / 2
  const below   = room.foot - flat.y - flat.height
  const clearX  = PLACE.left + fonts.set(CAPS, PLACE.size, place).width + 10
  const wall    = drawing.clip(h('path', {
    'clip-rule' : 'evenodd',
    'd'         : `M0 0H${card.WIDTH}V${tenth(room.foot)}H0ZM64 38H${tenth(clearX)}V78H64Z`
  }))
  const floor = drawing.clip(card.rect({
    height : card.HEIGHT - room.foot,
    width  : card.WIDTH,
    x      : 0,
    y      : room.foot
  }))
  const stroke = { 'fill': 'none', 'stroke': lines, 'stroke-width': 1.25 }

  drawing.add(
    h('g', { ...stroke, 'clip-path': wall }, steps.map((step) =>
      card.rect(card.around(flat, spread(step)), {
        'rx'             : tenth(spread(step)),
        'stroke-opacity' : 0.44 - step * 0.03
      })
    )),
    h('g', { ...stroke, 'clip-path': floor }, steps.filter((step) => spread(step) > below).map((step) => {
      const rx = flat.width / 2 + Math.sqrt(spread(step) ** 2 - below ** 2)

      return h('ellipse', {
        'cx'             : tenth(middle),
        'cy'             : tenth(room.foot),
        'rx'             : tenth(rx),
        'ry'             : tenth(rx * 0.34),
        'stroke-opacity' : 0.3 - step * 0.022
      })
    }))
  )

  room.window(0.45, 0.7, index, color)
  room.beam(cast, color, pane, 0.14)

  if (direct) room.light(cast, color)
  else drawing.add(drawing.blurred(9, 0.92, room.shapes(cast, color)))

  const { glazed } = room
  const sill       = {
    height : 54,
    width  : glazed.width + 60,
    x      : glazed.x - 30,
    y      : glazed.y + glazed.height + 10
  }

  drawing.add(card.rect(sill, { fill: color }))
  drawing.say(card.ADDRESS, faces.MONO, {
    anchor : 'middle',
    fill   : greatest([ground, ink], (each) => wcagContrast(each, color))!,
    size   : 36,
    x      : sill.x + sill.width / 2,
    y      : sill.y + 41
  })

  const mark    = sky.holding(painted, color, 4.8, ink)
  const capLine = fonts.set(CAPS, PLACE.size, 'H').ink.top
  const quiet   = sky.holding(painted, muted, 6, ink)

  drawing.add(card.rect({
    height : 2,
    width  : 44,
    x      : LEFT,
    y      : PLACE.baseline - capLine / 2 - 1
  }, { fill: mark }))
  drawing.say(place, CAPS, { fill: mark, size: PLACE.size, x: PLACE.left, y: PLACE.baseline })

  for (const [row, line] of wrapped(fonts, title).entries()) {
    drawing.say(line, ROMAN, { fill: ink, size: TITLE.size, x: LEFT, y: TITLE.y + row * TITLE.lead })
  }

  drawing.say(`${day.clock(minute)} · SUN ${signed(`${Math.round(sun)}°`)}`, CAPS, {
    fill : quiet,
    size : 28,
    x    : LEFT,
    y    : BASE - 132
  })

  const figure          = formatLux(lux)
  const { left, right } = fonts.set(FIGURE, 148, figure).ink

  drawing.say(figure, FIGURE, { fill: ink, size: 148, x: LEFT, y: BASE })
  drawing.say('lux', faces.MONO, { fill: ink, size: 46, x: LEFT + right - left + WORD_GAP, y: BASE })

  const { from, to, top } = STRIP
  const stripAt           = (at: number) => unlerp(from, to, at) * card.WIDTH

  drawing.add(
    card.rect({ height: card.HEIGHT - top, width: card.WIDTH, x: 0, y: top }, {
      fill: drawing.across(60, (share) => sky.colorAt(day.readings[Math.round(lerp(from, to, share))]!))
    }),
    ...HOURS.map((hour) =>
      card.rect({ height: 9, width: 2, x: stripAt(hour) - 1, y: top }, { fill: ground })
    ),
    card.rect({ height: card.HEIGHT - top + 20, width: 34, x: stripAt(minute) - 17, y: top - 14 }, {
      'fill'         : color,
      'stroke'       : ink,
      'stroke-width' : 3
    })
  )

  return drawing
}
