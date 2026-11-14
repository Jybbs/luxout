import { readFile } from 'node:fs/promises'

import { range }                     from 'd3-array'
import { scaleLinear }               from 'd3-scale'
import { lineRadial, pointRadial }   from 'd3-shape'
import { type VNode, cloneVNode, h } from 'vue'
import { renderToString }            from 'vue/server-renderer'

import { CLOUD_TUNING }                from '../../../../src/daylight/cloud-factor.ts'
import * as faces                      from '../cards/faces.ts'
import * as clock                      from '../daylight/clock.ts'
import { type DayDial, dayDial }       from '../daylight/day-dial.ts'
import * as dialLens                   from '../daylight/dial-lens.ts'
import { formatFactor, formatLux }     from '../daylight/format.ts'
import { SampleDay }                   from '../daylight/sample-day.ts'
import { SVG_NAMESPACE }               from '../daylight/svg.ts'
import { tenth }                       from '../daylight/tenth.ts'
import recording                       from '../search/recording.json' with { type: 'json' }
import { type Scheme, Tokens }         from '../theme/tokens.ts'
import { DarkOut, ForecastSteps }      from './lanes.ts'
import { record }                      from './recording.ts'

/**
 * Draws the Day Estimate dial from the paths of each half of the clock, with the
 * stretch at `selected` lit and the one at `peek` drawn, as the site's widget
 * draws it.
 */
type DialDrawing = (
  sample   : DayDial,
  rest     : readonly (readonly string[])[],
  selected : number,
  peek     : number
) => VNode

/**
 * What one lane beside the dial shows at a minute, its chip lit as the sensor
 * on or as a step in use where `state` names either.
 */
interface Lane {
  chip   : string
  marks  : VNode[]
  title  : string
  width  : number
  words  : readonly [left: string, right: string]
  state? : 'on' | 'step'
}

/**
 * Where a word of the frame sits, its baseline at `y` and its anchor at `x`.
 */
interface Place extends Pick<faces.Saying, 'anchor' | 'size' | 'x' | 'y'> {
  voice : faces.Voice
}

const FRAMES = 500  // The frames of one pass around the dial, ten seconds at 20 milliseconds a frame
const HEIGHT = 330
const MONO   = { axes: { wght: 600 }, face: 'mono' } as const
const QUIET  = { axes: { wght: 400 }, face: 'mono' } as const
const SHEETS = ['daylight/day-estimate-frame.css', 'readme/day-preview-frame.css']
const WIDTH  = 880  // The pixels the preview is recorded wide, past the README column GitHub shows
/**
 * The frame's parts in pixels, the dial's own in the dial's units, and each
 * lane's in pixels down from the lane's top.
 */
const LAYOUT = {
  bar     : 0.6,  // The gap on each side of a step's bar
  caption : { gap: 18, size: 12, voice: QUIET },
  chip    : { height: 28, lift: 4.9, size: 14, voice: MONO, y: 2 },
  cursor  : { from: 56, to: 90 },
  dial    : { scale: 0.86, y: 7 },
  dot     : 3.5,
  figure  : { rise: 3.1, size: 26, voice: { axes: { opsz: 6, wght: 800 }, face: 'display' } },
  hours   : { size: 12, voice: QUIET, y: 106 },
  lanes   : { from: 404, to: 872, tops: [26, 178] },
  name    : { lift: 4.5, size: 13, voice: MONO },
  title   : { size: 24, voice: { axes: { opsz: 18, wght: 600 }, face: 'display' }, y: 22 },
  track   : { height: 22, y: 62 },
  widths  : { forecast: 84, sensor: 66 },
  words   : { size: 13, voice: QUIET, y: 48 }
} as const

/**
 * Draws the frames of the README's preview, the Day Estimate dial sweeping once
 * around the sample day beside the threshold sensor Dark Out and the forecast's
 * steps of sunlight, and records them as a GIF.
 */
export class DayPreview {
  static readonly MINUTES = spread(FRAMES)
  static readonly PACING  = { hold: 1600, step: 20 }  // Milliseconds
  readonly #across   : (minute: number) => number
  readonly #day      : SampleDay
  readonly #dial     : DayDial
  readonly #draw     : DialDrawing
  readonly #faces    : faces.Faces
  readonly #forecast : ForecastSteps
  readonly #inks     : Record<Scheme, { ink: string, muted: string }>
  readonly #paths    : readonly (readonly string[])[]
  readonly #sensor   : DarkOut
  readonly #sheets   : Record<Scheme, string>
  readonly #tokens   : Tokens

  /**
   * Reads the faces, the theme's tokens, and the frame's stylesheets from
   * beneath `root`, the site's `.vitepress` directory, drawing the dial through
   * `draw`.
   */
  static async read(root: URL, draw: DialDrawing): Promise<DayPreview> {
    const [fonts, tokens, ...sheets] = await Promise.all([
      faces.Faces.read(root),
      Tokens.read(root),
      ...SHEETS.map((sheet) => readFile(new URL(`lib/${sheet}`, root), 'utf8'))
    ])

    return new DayPreview(draw, fonts, sheets.join('\n'), tokens)
  }

  constructor(draw: DialDrawing, fonts: faces.Faces, sheet: string, tokens: Tokens) {
    const day   = SampleDay.record()
    const dial  = dayDial(day)
    const plot  = new dialLens.DialPlot(dial.marks)
    const scale = scaleLinear([0, clock.DAY_MINUTES], [LAYOUT.lanes.from, LAYOUT.lanes.to])
    const inks  = (scheme: Scheme) => ({
      ink   : tokens.color('--color-ink', scheme),
      muted : tokens.color('--color-muted', scheme)
    })

    this.#across   = (minute) => tenth(scale(minute))
    this.#day      = day
    this.#dial     = dial
    this.#draw     = draw
    this.#faces    = fonts
    this.#forecast = new ForecastSteps(day)
    this.#inks     = { dark: inks('dark'), light: inks('light') }
    this.#paths    = dialLens.HALVES.map((half) => plot.paths(half, 0))
    this.#sensor   = new DarkOut(day)
    this.#sheets   = { dark: tokens.flatten(sheet, 'dark'), light: tokens.flatten(sheet, 'light') }
    this.#tokens   = tokens
  }

  /**
   * The text alternative the README's image carries, naming what the dial and
   * each lane show across the sample day.
   */
  get alt(): string {
    const { entry, switches } = this.#sensor
    const { steps }           = this.#forecast
    const [from, to]          = this.#day.span
    const at                  = (minute: number) => this.#day.clock(minute)

    return `The Day Estimate dial sweeping once around the sample day in ${recording.results[0]!.name} `
         + `beside the threshold sensor ${entry.name} switching off at ${at(switches[0]!)} as the `
         + `dawn passes ${formatLux(entry.offLux)} lux and on at ${at(switches[1]!)} as the dusk `
         + `falls to ${formatLux(entry.onLux)} lux, and the forecast’s ${steps.length} quarter-hour `
         + `steps of sunlight at the ground from ${at(from)} to ${at(to)}, the step in use lit, its `
         + 'sunlight divided by the clear sky’s to give the factor, and a step with the sun under '
         + `${CLOUD_TUNING.floor}° taking the mean factor of the ${CLOUD_TUNING.nearest} nearest `
         + 'daylight steps.'
  }

  /**
   * Draws the frame at `minute` past midnight in `scheme`.
   */
  frame(minute: number, scheme: Scheme): VNode {
    const { dial } = LAYOUT

    return h('svg', {
      height  : HEIGHT,
      viewBox : `0 0 ${WIDTH} ${HEIGHT}`,
      width   : WIDTH,
      xmlns   : SVG_NAMESPACE
    }, [
      h('style', { innerHTML: this.#sheets[scheme] }),
      h('rect', { fill: this.#tokens.color('--color-ground', scheme), height: HEIGHT, width: WIDTH }),
      h('g', { transform: `translate(0 ${dial.y}) scale(${dial.scale})` }, this.#dialAt(minute, scheme)),
      ...this.#sensorLane(minute, scheme),
      ...this.#forecastLane(minute, scheme)
    ])
  }

  /**
   * Records one pass around the dial in `scheme` as a GIF that loops without
   * end.
   */
  async record(scheme: Scheme): Promise<Uint8Array> {
    const seeds    = this.#sheets[scheme].match(/#[\da-f]{6}/gi) ?? []
    const drawings = await Promise.all(DayPreview.MINUTES.map((minute) =>
      renderToString(this.frame(minute, scheme))
    ))

    return record(drawings, { ...DayPreview.PACING, seeds })
  }

  /**
   * Draws the dial at `minute`, the reading traced from midnight to the hand,
   * the stretches holding the minute lit, the reading set in the hub, and each
   * stretch's name outside the rim.
   */
  #dialAt(minute: number, scheme: Scheme): VNode[] {
    const { caption, dot, figure, name } = LAYOUT
    const { center, floor, rim }         = dialLens.DIAL

    const { marks, stretches } = this.#dial
    const angle                = (at: number) => at / clock.DAY_MINUTES * 2 * Math.PI + Math.PI
    const radius               = (at: number) =>
      floor + (rim - floor) * marks.reading[at % clock.DAY_MINUTES]!
    const holding = (outer: boolean) => stretches.findIndex((stretch, index) => {
      const [from, to] = marks.spans[index]!
      const turns      = [minute, minute + clock.DAY_MINUTES]

      return stretch.outer === outer && turns.some((at) => from <= at && at < to)
    })
    const trace          = lineRadial<number>().angle(angle).radius(radius).digits(1)
    const point          = (reach: number) => pointRadial(angle(minute), reach).map(tenth)
    const [x, y]         = point(radius(minute))
    const { ink, muted } = this.#inks[scheme]
    const hub            = (text: string, fill: string, place: Omit<Place, 'x' | 'y'>, rise: number) =>
      this.#say(text, fill, { ...place, anchor: 'middle', x: center.x, y: center.y + rise })

    return [
      cloneVNode(this.#draw(this.#dial, this.#paths, holding(false), holding(true)), {
        height : dialLens.DIAL.height,
        width  : dialLens.DIAL.width
      }),
      h('g', { transform: `translate(${center.x} ${center.y})` }, [
        h('path', { class: 'day-estimate-line', d: trace(range(minute + 1))! }),
        h('path', { class: 'day-preview-hand', d: `M${point(floor).join(' ')}L${point(rim + 6).join(' ')}` }),
        h('circle', { class: 'day-preview-dot', cx: x, cy: y, r: dot })
      ]),
      hub(formatLux(this.#day.readings[minute]!), ink, figure, figure.rise),
      hub(`lux at ${this.#day.clock(minute)}`, muted, caption, figure.rise + caption.gap),
      ...stretches.map(({ name: word, place }) => this.#say(word, ink, {
        ...name,
        anchor : 'middle',
        x      : tenth(place.left / 100 * dialLens.DIAL.width),
        y      : tenth(place.top / 100 * dialLens.DIAL.height + name.lift)
      }))
    ]
  }

  /**
   * Draws the forecast's lane at `minute`, each step's bar as tall as its
   * sunlight, the steps before the minute filled and the step in use lit.
   */
  #forecastLane(minute: number, scheme: Scheme): VNode[] {
    const { bar, lanes, track } = LAYOUT

    const { steps } = this.#forecast
    const step      = this.#forecast.at(minute)
    const top       = lanes.tops[1]
    const wide      = this.#across(clock.STEP_MINUTES) - this.#across(0) - 2 * bar
    const words     = step === undefined
                    ? `${this.#day.clock(minute)} · no step, clear sky`
                    : step.borrowed === undefined
                    ? `step ${step.clock} · ${step.forecast} ÷ ${step.clear}`
                    + (step.held ? ', held at 1' : '')
                    : `step ${step.clock} · sun under ${CLOUD_TUNING.floor}°, `
                    + `mean of ${step.borrowed} steps`

    return this.#lane(top, minute, scheme, {
      chip  : step === undefined ? 'none' : `×${formatFactor(step.factor)}`,
      state : step === undefined ? undefined : 'step',
      title : 'The Forecast',
      width : LAYOUT.widths.forecast,
      words : [words, `${steps.length} steps`],

      marks: steps.map((each) => {
        const tall = tenth(Math.max(1, track.height * each.share))

        return h('rect', {
          'class'     : 'day-preview-step',
          'data-now'  : each === step || undefined,
          'data-past' : each.minute <= minute || undefined,
          'height'    : tall,
          'width'     : tenth(wide),
          'x'         : tenth(this.#across(each.minute) + bar),
          'y'         : tenth(top + track.y + track.height - tall)
        })
      })
    })
  }

  /**
   * Draws a lane beside the dial whose top sits at `top`, its title and chip,
   * its words, its track holding `marks`, the cursor at `minute`, and the
   * hours beneath.
   */
  #lane(
    top    : number,
    minute : number,
    scheme : Scheme,
    { chip, marks, state, title, width, words }: Lane
  ): VNode[] {
    const { cursor, hours, lanes, track } = LAYOUT

    const { ink, muted } = this.#inks[scheme]
    const last           = clock.HOUR_MARKS.length - 1
    const ends           = (index: number) => index === 0 ? 'start' : index === last ? 'end' : 'middle'

    return [
      this.#say(title, ink, { ...LAYOUT.title, x: lanes.from, y: top + LAYOUT.title.y }),
      h('rect', {
        class  : state === undefined ? 'day-preview-chip' : `day-preview-chip day-preview-chip-${state}`,
        height : LAYOUT.chip.height,
        rx     : LAYOUT.chip.height / 2,
        width  : width,
        x      : lanes.to - width,
        y      : top + LAYOUT.chip.y
      }),
      this.#say(chip, state === undefined ? muted : ink, {
        ...LAYOUT.chip,
        anchor : 'middle',
        x      : lanes.to - width / 2,
        y      : top + LAYOUT.chip.y + LAYOUT.chip.height / 2 + LAYOUT.chip.lift
      }),
      this.#say(words[0], muted, { ...LAYOUT.words, x: lanes.from, y: top + LAYOUT.words.y }),
      this.#say(words[1], muted, { ...LAYOUT.words, anchor: 'end', x: lanes.to, y: top + LAYOUT.words.y }),
      h('rect', {
        class  : 'day-preview-track',
        height : track.height,
        width  : lanes.to - lanes.from,
        x      : lanes.from,
        y      : top + track.y
      }),
      ...marks,
      h('path', {
        class : 'day-preview-cursor',
        d     : `M${this.#across(minute)} ${top + cursor.from}V${top + cursor.to}`
      }),
      ...clock.HOUR_MARKS.map((hour, index) => this.#say(`${clock.hourWord(hour)}:00`, muted, {
        ...hours,
        anchor : ends(index),
        x      : this.#across(hour * clock.HOUR_MINUTES),
        y      : top + hours.y
      }))
    ]
  }

  /**
   * Sets `text` where `place` puts it, in capitals wherever its face is the
   * mono face.
   */
  #say(text: string, fill: string, { anchor, size, voice, x, y }: Place): VNode {
    const words = voice.face === 'mono' ? text.toUpperCase() : text

    return this.#faces.say(words, voice, { anchor, fill, size, x, y })
  }

  /**
   * Draws the sensor's lane at `minute`, each span it has been on since
   * midnight filled.
   */
  #sensorLane(minute: number, scheme: Scheme): VNode[] {
    const { lanes, track } = LAYOUT

    const { entry } = this.#sensor
    const on        = this.#sensor.states[minute]!
    const count     = this.#sensor.countBy(minute)
    const top       = lanes.tops[0]

    return this.#lane(top, minute, scheme, {
      chip  : on ? 'on' : 'off',
      state : on ? 'on' : undefined,
      title : entry.name,
      width : LAYOUT.widths.sensor,
      words : [
        `on at ${formatLux(entry.onLux)} lux, off past ${formatLux(entry.offLux)}`,
        `switched ${count === 1 ? 'once' : `${count} times`}`
      ],

      marks: this.#sensor.spansBy(minute).map(([start, end]) => h('rect', {
        class  : 'day-preview-on',
        height : track.height,
        width  : tenth(Math.max(1, this.#across(end) - this.#across(start))),
        x      : this.#across(start),
        y      : top + track.y
      }))
    })
  }
}

/**
 * Spreads `count` minutes evenly from midnight to the next midnight.
 */
function spread(count: number): number[] {
  return range(count).map((at) => Math.round(at * clock.DAY_MINUTES / (count - 1)))
}

/**
 * Names the file the preview in `scheme` is served from, beneath the site's
 * root.
 */
export function previewAddress(scheme: Scheme): string {
  return `/readme/day-estimate-${scheme}.gif`
}
