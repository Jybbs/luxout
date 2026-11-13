import { readFile } from 'node:fs/promises'

import { bisectRight, range }        from 'd3-array'
import { lineRadial, pointRadial }   from 'd3-shape'
import { type VNode, cloneVNode, h } from 'vue'
import { renderToString }            from 'vue/server-renderer'

import * as faces                       from '../cards/faces.ts'
import { shadeAt }                      from '../cards/sky.ts'
import { DAY_MINUTES }                  from '../daylight/clock.ts'
import { DEPTHS, type DayDial, dayDial } from '../daylight/day-dial.ts'
import * as dialLens                    from '../daylight/dial-lens.ts'
import { formatLux }                    from '../daylight/format.ts'
import { SampleDay }                    from '../daylight/sample-day.ts'
import { tenth }                        from '../daylight/tenth.ts'
import { type Scheme, Tokens }          from '../theme/tokens.ts'
import { record }                       from './recording.ts'

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
 * Where a word of the frame sits, its baseline at `y` and its middle at `x`.
 */
interface Place extends Pick<faces.Saying, 'size' | 'x' | 'y'> {
  voice : faces.Voice
}

const FRAMES  = 500  // The frames of one pass around the dial, ten seconds at 20 milliseconds a frame
const HEIGHT  = 330
const HORIZON = 292
/**
 * Names the stretch of the day by how many of `DEPTHS` the sun stands at or
 * above.
 */
const PHASES = ['Night', 'Astronomical twilight', 'Nautical twilight', 'Civil twilight', 'Daylight']
const SHEETS = ['daylight/day-estimate-frame.css', 'readme/day-preview-frame.css']
const SVG    = 'http://www.w3.org/2000/svg'
const WIDTH  = 880  // The pixels the preview is recorded wide, past the README column GitHub shows
/**
 * The frame's parts in pixels, the dial's own in the dial's units.
 */
const LAYOUT = {
  caption : { gap: 18, size: 12, voice: { axes: { wght: 400 }, face: 'mono' } },
  clock   : { size: 54, voice: { axes: { opsz: 6, wght: 800 }, face: 'display' }, x: 132, y: 166 },
  cursor  : { from: HORIZON + 3, to: HORIZON + 27 },
  dial    : { scale: 0.76, y: 12 },
  dot     : 3.5,
  figure  : { rise: 3.1, size: 26, voice: { axes: { opsz: 6, wght: 800 }, face: 'display' } },
  phase   : { size: 22, voice: { axes: { opsz: 18, wght: 600 }, face: 'display' }, x: 748, y: 160 },
  plate   : { height: 276, rx: 14, width: 340, y: 8 },
  strip   : { bands: 220, height: 14, y: HORIZON + 8 }
} as const

/**
 * Draws the frames of the README's preview, the Day Estimate dial sweeping once
 * around the sample day in a frame that takes the sky's color at each minute,
 * and records them as a GIF.
 */
export class DayPreview {
  static readonly MINUTES = spread(FRAMES)
  static readonly PACING  = { hold: 1600, step: 20 }  // Milliseconds
  readonly #day    : SampleDay
  readonly #dial   : DayDial
  readonly #draw   : DialDrawing
  readonly #faces  : faces.Faces
  readonly #paths  : readonly (readonly string[])[]
  readonly #sheets : Record<Scheme, string>
  readonly #tokens : Tokens

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
    const day  = SampleDay.record()
    const dial = dayDial(day)
    const plot = new dialLens.DialPlot(dial.marks)

    this.#day    = day
    this.#dial   = dial
    this.#draw   = draw
    this.#faces  = fonts
    this.#paths  = dialLens.HALVES.map((half) => plot.paths(half, 0))
    this.#sheets = { dark: tokens.flatten(sheet, 'dark'), light: tokens.flatten(sheet, 'light') }
    this.#tokens = tokens
  }

  /**
   * Draws the frame at `minute` past midnight in `scheme`.
   */
  frame(minute: number, scheme: Scheme): VNode {
    const { clock, cursor, dial, phase, plate, strip } = LAYOUT

    const ground = this.#tokens.resolve('--vp-c-bg', scheme)
    const sky    = shadeAt(this.#day.readings[minute]!)
    const across = tenth(minute / DAY_MINUTES * WIDTH)
    const left   = tenth((WIDTH - dialLens.DIAL.width * dial.scale) / 2)
    const shift  = `translate(${left} ${dial.y}) scale(${dial.scale})`

    return h('svg', { height: HEIGHT, viewBox: `0 0 ${WIDTH} ${HEIGHT}`, width: WIDTH, xmlns: SVG }, [
      h('style', { innerHTML: this.#sheets[scheme] }),
      h('rect', { fill: ground, height: HEIGHT, width: WIDTH }),
      h('rect', { fill: sky.fill, height: HORIZON, width: WIDTH }),
      h('rect', { ...plate, class: 'day-preview-plate', x: (WIDTH - plate.width) / 2 }),
      h('g', { transform: shift }, this.#dialAt(minute, scheme)),
      this.#say(this.#day.clock(minute), sky.ink, clock),
      this.#say(PHASES[bisectRight(DEPTHS, this.#day.altitudes[minute]!)]!, sky.ink, phase),
      ...spread(strip.bands).map((at, band) => h('rect', {
        fill   : shadeAt(this.#day.readings[at]!).fill,
        height : strip.height,
        width  : tenth(WIDTH / strip.bands + 0.6),
        x      : tenth(band * WIDTH / strip.bands),
        y      : strip.y
      })),
      h('path', { class: 'day-preview-cursor', d: `M${across} ${cursor.from}V${cursor.to}` })
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
   * the stretches holding the minute lit, and the reading set in the hub.
   */
  #dialAt(minute: number, scheme: Scheme): VNode[] {
    const { caption, dot, figure } = LAYOUT
    const { center, floor, rim }   = dialLens.DIAL

    const { marks, stretches } = this.#dial
    const angle                = (at: number) => at / DAY_MINUTES * 2 * Math.PI + Math.PI
    const radius               = (at: number) => floor + (rim - floor) * marks.reading[at % DAY_MINUTES]!
    const holding              = (outer: boolean) => stretches.findIndex((stretch, index) => {
      const [from, to] = marks.spans[index]!

      return stretch.outer === outer && [minute, minute + DAY_MINUTES].some((at) => from <= at && at < to)
    })
    const trace  = lineRadial<number>().angle(angle).radius(radius).digits(1)
    const point  = (reach: number) => pointRadial(angle(minute), reach).map(tenth)
    const [x, y] = point(radius(minute))
    const ink    = this.#tokens.resolve('--vp-c-text-1', scheme)
    const muted  = this.#tokens.resolve('--vp-c-text-2', scheme)
    const hub    = (text: string, fill: string, place: Omit<Place, 'x' | 'y'>, rise: number) =>
      this.#say(text, fill, { ...place, x: center.x, y: center.y + rise })

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
      hub(`lux at ${this.#day.clock(minute)}`, muted, caption, figure.rise + caption.gap)
    ]
  }

  #say(text: string, fill: string, { size, voice, x, y }: Place): VNode {
    return this.#faces.say(text, voice, { anchor: 'middle', fill, size, x, y })
  }
}

/**
 * Spreads `count` minutes evenly from midnight to the next midnight.
 */
function spread(count: number): number[] {
  return range(count).map((at) => Math.round(at * DAY_MINUTES / (count - 1)))
}

/**
 * Names the file the preview in `scheme` is served from, beneath the site's
 * root.
 */
export function previewAddress(scheme: Scheme): string {
  return `/readme/day-estimate-${scheme}.gif`
}
