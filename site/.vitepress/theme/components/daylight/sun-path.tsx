import { range } from 'd3-array'
import { type VNode, defineComponent, onMounted, shallowRef, useId } from 'vue'

import { DAY_MINUTES }                    from '../../../lib/daylight/clock.ts'
import { formatClock, formatDayOfYear }   from '../../../lib/daylight/format.ts'
import * as curve                         from '../../../lib/daylight/sun-curve.ts'
import { data }                           from '../../../lib/daylight/sun-year.data.ts'
import { Glide }                          from '../../../lib/motion/glide.ts'
import { Speech }                         from '../../../lib/motion/speech.ts'
import { DURATIONS }                      from '../../../lib/motion/timing.ts'
import { Disclosure }                     from '../../controls/disclosure.tsx'
import { layers }                         from '../../controls/layers.tsx'
import { OVERLAY, PlotSlider, plotSpans } from '../../controls/plot-slider.tsx'
import { sunDrawing }                     from './sun-drawing.tsx'

/**
 * The moves one drawing writes for each day of the year.
 */
interface DayMoves {
  readonly closed : readonly string[]
  readonly open   : readonly string[]
  readonly rise   : readonly string[]
  readonly set    : readonly string[]
  readonly top    : readonly string[]
}

/**
 * The utilities the widget draws each mark of its drawings in, by the class the
 * mark carries, the chosen day's curve drawn heavier and the year's curves
 * shown while the year is open, and the grip shown while the sun is down.
 */
const MARKS = [
  '[&_:is(.sun-path-word,.sun-path-figure)]:text-[11px] [&_.sun-path-word]:fill-muted',
  '[&_.sun-path-figure]:fill-ink [&_.sun-path-grid]:stroke-rule [&_.sun-path-grid]:stroke-1',
  '[&_:is(.sun-path-glow-inner,.sun-path-glow-outer)]:[stop-color:var(--color-sky)]',
  '[&_.sun-path-glow-inner]:[stop-opacity:0.55] [&_.sun-path-glow-outer]:[stop-opacity:0]',
  '[&_.sun-path-sun]:fill-sky [&_.sun-path-sun]:stroke-ink [&_.sun-path-sun]:stroke-1',
  '[&_.sun-path-ground]:fill-sunken [&_.sun-path-horizon]:stroke-ink [&_.sun-path-horizon]:stroke-[1.2]',
  '[&_:is(.sun-path-curve,.sun-path-hair,.sun-path-wash)]:[vector-effect:non-scaling-stroke]',
  '[&_.sun-path-curve]:fill-none [&_.sun-path-curve]:stroke-geometry [&_.sun-path-curve]:stroke-[2.4]',
  '[&_.sun-path-curve]:[stroke-linecap:round] [&_.sun-path-curve]:[stroke-linejoin:round]',
  '[&_.sun-path-curve]:transition-[stroke-width] [&_.sun-path-curve]:duration-(--timing-fade)',
  '[&.year_.sun-path-curve]:stroke-[3.4] [&_.sun-path-crossing]:fill-geometry',
  '[&_.sun-path-year]:opacity-0 [&_.sun-path-year]:transition-opacity',
  '[&_.sun-path-year]:duration-(--timing-fade) [&.year_.sun-path-year]:opacity-100',
  '[&_.sun-path-wash]:fill-geometry [&_.sun-path-wash]:[fill-opacity:0.16]',
  '[&_.sun-path-hair]:fill-none [&_.sun-path-hair]:stroke-sun-hair [&_.sun-path-hair]:stroke-1',
  '[&_.sun-path-hair]:[stroke-linejoin:round] [&_.sun-path-month]:[stroke-dasharray:2_3]',
  '[&_.sun-path-grip]:invisible data-down:[&_.sun-path-grip]:visible',
  '[&_.sun-path-grip-face]:fill-raised [&_.sun-path-grip-face]:stroke-ink',
  '[&_.sun-path-grip-face]:stroke-[1.5]'
]
/**
 * The utilities the plot takes, showing the one drawing whose layout fits the
 * width of the widget and spanning the clock's slider over that drawing's plot.
 */
const PLOT = [
  'relative [&>svg]:hidden [&>svg]:h-auto [&>svg]:w-full [&>svg]:overflow-hidden [&>svg]:widget-num',
  '[&>svg:nth-of-type(1)]:block @md:[&>svg:nth-of-type(1)]:hidden @md:[&>svg:nth-of-type(2)]:block',
  '@md:[--plot-left:var(--plot-left-1)] @md:[--plot-right:var(--plot-right-1)]'
]
const SPANS = plotSpans(curve.SUN_LAYOUTS)

const { days, marks, minutes, months, rest, sample, year } = data

const BAND     = 17  // The height under the 90° line of the word that names the chosen day
const LAST_DAY = days.length - 1
const lefts    = days.map((_, index) => `${index / LAST_DAY * 100}%`)
/**
 * The utilities the year track and its thumb take, beside where the thumb
 * starts.
 */
const TRACK = {
  at      : lefts[sample]!,
  control : 'widget-track sun-path-track mx-2',
  thumb   : 'widget-thumb sun-path-thumb'
}

/**
 * The strings one day of the year writes, whichever layout shows it.
 */
class DayWords {
  readonly closed : string
  readonly curve  : string
  readonly open   : string
  readonly rise   : string
  readonly set    : string
  readonly text   : string

  constructor(index: number) {
    const day  = days[index]!
    const name = dayName(index)
    const rise = formatClock(day.rise)
    const set  = formatClock(day.set)
    const peak = curve.peakWord(day)

    this.closed = peak
    this.curve  = curve.sunCurve(day)
    this.open   = `${name} · ${peak}`
    this.rise   = `Sunrise ${rise}`
    this.set    = `Sunset ${set}`
    this.text   = `${name}, the sun up from ${rise} to ${set} and highest at ${peak}`
  }
}

/**
 * Writes one drawing's sun at each minute and its day's marks on each day
 * through strings built ahead of any motion, so a glide allocates nothing as it
 * moves.
 */
class SunPlot {
  readonly #cursor : SVGGElement
  readonly #curve  : SVGPathElement
  #dayMoves        : DayMoves | undefined
  readonly #grip   : SVGGElement
  readonly #height : SVGGElement
  readonly #layout : curve.SunLayout
  readonly #moves  : readonly string[]
  readonly #peak   : SVGGElement
  readonly #peakAt : SVGTextElement
  readonly #rise   : SVGGElement
  readonly #riseAt : SVGTextElement
  readonly #rises  : readonly string[]
  readonly #set    : SVGGElement
  readonly #setAt  : SVGTextElement
  readonly #top    : SVGCircleElement
  readonly #wash   : SVGPathElement

  constructor(layout: curve.SunLayout, svg: SVGSVGElement) {
    this.#cursor = svg.querySelector('.sun-path-cursor')!
    this.#curve  = svg.querySelector('.sun-path-curve')!
    this.#grip   = svg.querySelector('.sun-path-grip')!
    this.#height = svg.querySelector('.sun-path-height')!
    this.#layout = layout
    this.#moves  = range(DAY_MINUTES).map((minute) => layout.moveAcross(minute))
    this.#peak   = svg.querySelector('.sun-path-peak')!
    this.#peakAt = this.#peak.querySelector('text')!
    this.#rise   = svg.querySelector('.sun-path-rise')!
    this.#riseAt = this.#rise.querySelector('text')!
    this.#rises  = range((layout.height + layout.glow) * 10).map((place) => `translate(0 ${place / 10})`)
    this.#set    = svg.querySelector('.sun-path-set')!
    this.#setAt  = this.#set.querySelector('text')!
    this.#top    = svg.querySelector('.sun-path-top')!
    this.#wash   = svg.querySelector('.sun-path-wash')!
  }

  place(altitude: number, minute: number): void {
    const place = Math.min(Math.round(this.#layout.yOf(altitude) * 10), this.#rises.length - 1)

    this.#cursor.setAttribute('transform', this.#moves[minute]!)
    this.#height.setAttribute('transform', this.#rises[place]!)
    this.#grip.setAttribute('transform', this.#moves[minute]!)
  }

  /**
   * Builds the moves every day of the year writes, which the first opening of
   * the year runs ahead of any motion.
   */
  prepare(): void {
    const layout = this.#layout
    const band   = layout.yOf(90) + BAND

    this.#dayMoves = {
      closed : days.map((day) => layout.moveOver(day)),
      open   : days.map(({ peak }) => `translate(${layout.xOf(peak.minute)} ${band})`),
      rise   : days.map(({ rise }) => layout.moveAcross(rise)),
      set    : days.map(({ set }) => layout.moveAcross(set)),
      top    : days.map((day) => layout.moveTo(day))
    }
  }

  show(index: number, open: boolean, words: DayWords): void {
    const moves = this.#dayMoves!

    this.#curve.setAttribute('d', words.curve)
    this.#wash.setAttribute('d', words.curve)
    this.#rise.setAttribute('transform', moves.rise[index]!)
    this.#riseAt.textContent = words.rise
    this.#set.setAttribute('transform', moves.set[index]!)
    this.#setAt.textContent = words.set
    this.#top.setAttribute('transform', moves.top[index]!)
    this.#peak.setAttribute('transform', (open ? moves.open : moves.closed)[index]!)
    this.#peakAt.textContent = open ? words.open : words.closed
  }
}

/**
 * Holds the minute and the day a reader chooses, moving each drawing directly
 * and writing the sentence beneath them once a motion ends.
 */
class SunWatch {
  readonly clock  : PlotSlider
  readonly dates  : PlotSlider
  readonly id     = useId()
  readonly open   = shallowRef(false)
  readonly root   = shallowRef<HTMLElement>()
  readonly speech = new Speech(this.root)
  readonly year   = new Disclosure(this.id, this.open, () => this.toggle())

  #day                  = sample
  readonly #dayGlide    : Glide
  #minute               = rest
  readonly #minuteGlide : Glide
  #plots                : readonly SunPlot[] = []
  readonly #shown       = shallowRef(sample)
  #thumb                : HTMLElement | undefined
  #words                : readonly DayWords[] = []

  constructor() {
    this.#dayGlide = new Glide(
      sample,
      this.root,
      () => this.#settle(),
      (value) => this.#writeDay(Math.round(value)),
      DURATIONS.settle
    )
    this.#minuteGlide = new Glide(
      rest,
      this.root,
      () => this.#settle(),
      (value) => this.#writeMinute(Math.round(value))
    )
    this.clock = new PlotSlider({
      count : DAY_MINUTES,
      label : 'Time of day',
      page  : 60,
      set   : (value, eased) => this.#minuteGlide.move(value, eased),
      text  : (minute) => clockText(this.#shown.value, minute),
      value : () => this.#minuteGlide.goal
    })
    this.dates = new PlotSlider({
      count : days.length,
      label : `Day of ${year}`,
      page  : 28,
      set   : (value, eased) => this.#dayGlide.move(value, eased),
      text  : (index) => (this.#words[index] ?? new DayWords(index)).text,
      value : () => this.#dayGlide.goal
    })

    onMounted(() => this.#mount())
  }

  /**
   * Opens the year on the day it last showed, or closes it and returns the
   * drawing to the sample day.
   */
  toggle(): void {
    this.open.value = !this.open.value

    if (this.open.value) this.#prepare()

    this.#writeDay(this.#day, true)

    if (!this.open.value) this.#dayGlide.ease(sample)
  }

  #mount(): void {
    const root = this.root.value!

    this.#plots = Array.from(root.querySelectorAll<SVGSVGElement>('.sun-path-drawing'), (svg, index) =>
      new SunPlot(curve.SUN_LAYOUTS[index]!, svg)
    )
    this.#thumb = root.querySelector('.sun-path-thumb')!
  }

  #placeSun(): void {
    const altitude = sunAltitude(this.#day, this.#minute)

    for (const plot of this.#plots) plot.place(altitude, this.#minute)

    this.root.value!.toggleAttribute('data-down', altitude < 0)
  }

  #prepare(): void {
    if (this.#words.length) return

    this.#words = days.map((_, index) => new DayWords(index))

    for (const plot of this.#plots) plot.prepare()
  }

  #settle(): void {
    const altitude = sunAltitude(this.#day, this.#minute)
    const phrase   = curve.sunPhrase(days[this.#day]!, altitude, this.#minute)
    const clock    = formatClock(this.#minute)
    const root     = this.root.value!

    root.querySelector('.sun-path-clock')!.textContent  = clock
    root.querySelector('.sun-path-phrase')!.textContent = phrase
    this.#shown.value                                   = this.#day
    this.dates.hold(this.#day)

    this.speech.say(`${clock}${this.open.value ? ` on ${dayName(this.#day)}` : ''}, ${phrase}`)
  }

  #writeDay(index: number, forced = false): void {
    if (index === this.#day && !forced) return

    this.#day = index

    const words = this.#words[index]!

    for (const plot of this.#plots) plot.show(index, this.open.value, words)

    this.#thumb!.style.left = lefts[index]!
    this.#placeSun()
  }

  #writeMinute(minute: number): void {
    if (minute === this.#minute) return

    this.#minute = minute
    this.#placeSun()
  }
}

/**
 * Draws the sun's height through a sample day as one curve over the horizon,
 * and a slider across the year that draws the chosen day as the one heavy line
 * with the sky beneath it washed, every other curve a gray hairline, the
 * solstices and the equinoxes solid and the months dashed.
 */
export const SunPath = defineComponent({
  name: 'SunPath',
  setup(_, { slots }) {
    const watch = new SunWatch()
    const glow  = useId()
    const words = curve.sunPhrase(days[sample]!, sunAltitude(sample, rest), rest)

    return () => (
      <div class={['widget sun-path grid gap-3', ...MARKS, { year: watch.open.value }]} ref={watch.root}>
        <div
          class={[
            'sun-path-lede [&_p]:m-0 [&_p]:text-lg/[1.5] [&_p]:text-pretty [&_strong]:font-semibold',
            '[&_strong]:whitespace-nowrap [&_strong]:lining-nums [&_strong]:tabular-nums'
          ]}
        >
          {...(slots.default?.() ?? [])}
        </div>
        <div class={PLOT} style={SPANS}>
          {curve.SUN_LAYOUTS.map((layout, index) => (
            sunDrawing(layout, data, `${glow}-${index}`, grip(layout))
          ))}
          {watch.clock.render(OVERLAY)}
        </div>
        <div
          class={[
            'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-t border-rule pt-2.5',
            '@max-md:grid-cols-[minmax(0,1fr)]'
          ]}
        >
          <div id={watch.id}>
            {layers(
              [
                <p class="m-0 min-h-[2lh] text-[0.9rem]/[1.45] @max-md:min-h-[3lh]">
                  <b class="sun-path-clock widget-num font-semibold">{formatClock(rest)}</b>
                  {' · '}
                  <span class="sun-path-phrase">{words}</span>
                </p>,
                <div>
                  {watch.dates.render(TRACK, () => [
                    <span class="widget-rail" />,
                    ...marks.map(({ day, named }) => (
                      <span
                        class={named
                          ? 'sun-path-named absolute top-4 h-1.75 w-0.5 -translate-x-1/2 bg-geometry'
                          : 'widget-tick'}
                        style={{ left: lefts[day] }}
                      />
                    ))
                  ])}
                  <div
                    aria-hidden
                    class={[
                      'relative mx-2 h-[1.2em] font-mono text-[0.6rem]/none font-medium text-muted',
                      '*:absolute *:top-0 *:-translate-x-1/2'
                    ]}
                  >
                    {...months.map(({ left, word }) => <span style={{ left: `${left}%` }}>{word}</span>)}
                  </div>
                </div>
              ],
              watch.open.value ? 1 : 0
            )}
          </div>
          {watch.year.button('The year', '@max-md:row-start-1 @max-md:justify-self-start')}
        </div>
      </div>
    )
  }
})

function clockText(day: number, minute: number): string {
  return `${formatClock(minute)}, ${curve.sunPhrase(days[day]!, sunAltitude(day, minute), minute)}`
}

function dayName(index: number): string {
  return formatDayOfYear(year, index)
}

function grip(layout: curve.SunLayout): VNode {
  return (
    <g class="sun-path-grip" transform={layout.moveAcross(rest)}>
      <circle class="sun-path-grip-face" cy={layout.horizon} r={8} />
    </g>
  )
}

function sunAltitude(index: number, minute: number): number {
  return index === sample ? minutes[minute]! : curve.altitudeOn(days[index]!, minute)
}
