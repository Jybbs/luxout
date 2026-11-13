import { range } from 'd3-array'
import { type VNode, defineComponent, onMounted, shallowRef, useId } from 'vue'

import { DAY_MINUTES }                  from '../../../lib/daylight/clock.ts'
import { formatClock, formatDayOfYear } from '../../../lib/daylight/format.ts'
import * as curve                       from '../../../lib/daylight/sun-curve.ts'
import { data }                         from '../../../lib/daylight/sun-year.data.ts'
import { Glide }                        from '../../../lib/motion/glide.ts'
import { DURATIONS }                    from '../../../lib/motion/timing.ts'
import { Announcer }                    from '../../controls/announcer.tsx'
import { layers }                       from '../../controls/layers.tsx'
import { moreButton }                   from '../../controls/more-button.tsx'
import { PlotSlider, shareAcross }      from '../../controls/plot-slider.ts'
import { sunDrawing }                   from './sun-drawing.tsx'

import './styles/sun-path.css'

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

const { days, marks, minutes, months, rest, sample, year } = data

const BAND     = 17  // The height under the 90° line of the word that names the chosen day
const LAST_DAY = days.length - 1
const lefts    = days.map((_, index) => `${index / LAST_DAY * 100}%`)
const nows     = range(DAY_MINUTES).map(String)

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
  readonly #svg    : SVGSVGElement
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
    this.#svg    = svg
    this.#top    = svg.querySelector('.sun-path-top')!
    this.#wash   = svg.querySelector('.sun-path-wash')!
  }

  get shown(): boolean {
    return this.#svg.getBoundingClientRect().width > 0
  }

  /**
   * Finds the minute under a pointer at `clientX`, clamped to the clock drawn.
   */
  minuteAt(clientX: number): number {
    return Math.round(shareAcross(this.#svg, clientX, this.#layout) * (DAY_MINUTES - 1))
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
  readonly announcer = new Announcer()
  readonly clock     : PlotSlider
  readonly dates     : PlotSlider
  readonly id        = useId()
  readonly open      = shallowRef(false)
  readonly root      = shallowRef<HTMLElement>()

  #day                  = sample
  readonly #dayGlide    : Glide
  #grab                 = 0
  #handle               : HTMLElement | undefined
  #minute               = rest
  readonly #minuteGlide : Glide

  /**
   * Holds how far from the thumb's center a press lands, ahead of the slider's
   * own press, so a press on the thumb leaves the day where it stands.
   */
  readonly #onPress = (event: PointerEvent): void => {
    const box = this.#thumb!.getBoundingClientRect()

    this.#grab = this.#thumb === event.target ? event.clientX - box.left - box.width / 2 : 0
  }

  /**
   * Steps Page Up and Page Down to the next and the previous day the drawing
   * holds a curve for, leaving every other key to the slider.
   */
  readonly #onYearKey = (event: KeyboardEvent): void => {
    const now  = this.#dayGlide.goal
    const goal = {
      PageDown : marks.findLast(({ day }) => day < now)?.day ?? 0,
      PageUp   : marks.find(({ day }) => day > now)?.day ?? LAST_DAY
    }[event.key]

    if (goal === undefined) {
      this.dates.listeners.onKeydown(event)

      return
    }

    event.preventDefault()
    this.#dayGlide.ease(goal)
  }

  #plots : readonly SunPlot[] = []
  #thumb : HTMLElement | undefined
  #track : HTMLElement | undefined
  #words : readonly DayWords[] = []

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
      count    : DAY_MINUTES,
      page     : 60,
      position : (clientX) => this.#plots.find((plot) => plot.shown)!.minuteAt(clientX),
      set      : (value, eased) => this.#minuteGlide.move(value, eased),
      value    : () => this.#minuteGlide.goal
    })
    this.dates = new PlotSlider({
      count    : days.length,
      page     : 28,
      position : (clientX) => this.#dayAt(clientX),
      set      : (value, eased) => this.#dayGlide.move(value, eased),
      value    : () => this.#dayGlide.goal
    })

    onMounted(() => this.#mount())
  }

  /**
   * Builds the year track's attributes from the slider's own, with
   * `#onYearKey` replacing the slider's key handler and `#onPress` capturing
   * each press ahead of the slider's.
   */
  get track() {
    return {
      ...this.dates.attributes(`Day of ${year}`, sample),
      onKeydown            : this.#onYearKey,
      onPointerdownCapture : this.#onPress
    }
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

  #dayAt(clientX: number): number {
    return Math.round(shareAcross(this.#track!, clientX - this.#grab) * LAST_DAY)
  }

  #mount(): void {
    const root = this.root.value!

    this.#plots = Array.from(root.querySelectorAll<SVGSVGElement>('.sun-path-drawing'), (svg, index) =>
      new SunPlot(curve.SUN_LAYOUTS[index]!, svg)
    )
    this.#handle = root.querySelector('.widget-slider')!
    this.#thumb  = root.querySelector('.sun-path-thumb')!
    this.#track  = root.querySelector('.sun-path-track')!
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
    this.#handle!.setAttribute('aria-valuetext', `${clock}, ${phrase}`)

    this.announcer.say(`${clock}${this.open.value ? ` on ${dayName(this.#day)}` : ''}, ${phrase}`)
  }

  #writeDay(index: number, forced = false): void {
    if (index === this.#day && !forced) return

    this.#day = index

    const words = this.#words[index]!

    for (const plot of this.#plots) plot.show(index, this.open.value, words)

    this.#track!.setAttribute('aria-valuenow', nows[index]!)
    this.#track!.setAttribute('aria-valuetext', words.text)
    this.#thumb!.style.left = lefts[index]!
    this.#placeSun()
  }

  #writeMinute(minute: number): void {
    if (minute === this.#minute) return

    this.#minute = minute
    this.#placeSun()
    this.#handle!.setAttribute('aria-valuenow', nows[minute]!)
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
      <div class={['widget', 'sun-path', { year: watch.open.value }]} ref={watch.root}>
        <div class="sun-path-lede">{...(slots.default?.() ?? [])}</div>
        <div class="sun-path-plot">
          {curve.SUN_LAYOUTS.map((layout, index) => (
            sunDrawing(layout, data, `${glow}-${index}`, grip(layout))
          ))}
          <div
            class="widget-slider"
            {...watch.clock.attributes('Time of day', rest, `${formatClock(rest)}, ${words}`)}
          />
        </div>
        <div class="sun-path-foot">
          <div id={watch.id}>
            {layers(
              [
                <p class="sun-path-note">
                  <b class="sun-path-clock widget-num">{formatClock(rest)}</b>
                  {' · '}
                  <span class="sun-path-phrase">{words}</span>
                </p>,
                <div>
                  <div class="widget-track sun-path-track" {...watch.track}>
                    <span class="widget-rail" />
                    {...marks.map(({ day, named }) => (
                      <span
                        class={['widget-tick', { 'sun-path-named': named }]}
                        style={{ left: lefts[day] }}
                      />
                    ))}
                    <span class="widget-thumb sun-path-thumb" style={{ left: lefts[sample] }} />
                  </div>
                  <div aria-hidden class="sun-path-months">
                    {...months.map(({ left, word }) => <span style={{ left: `${left}%` }}>{word}</span>)}
                  </div>
                </div>
              ],
              watch.open.value ? 1 : 0
            )}
          </div>
          {moreButton(watch.id, 'The year', watch.open.value, () => watch.toggle())}
        </div>
        {watch.announcer.region}
      </div>
    )
  }
})

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
