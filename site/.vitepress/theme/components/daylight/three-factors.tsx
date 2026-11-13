import { usePreferredReducedMotion, whenever }                       from '@vueuse/core'
import { type VNode, defineComponent, onMounted, shallowRef, useId } from 'vue'

import { HOUR_MARKS, hourWord }    from '../../../lib/daylight/clock.ts'
import { data }                    from '../../../lib/daylight/factor-day.data.ts'
import { FrameClock }              from '../../../lib/motion/frame-clock.ts'
import { Glide }                   from '../../../lib/motion/glide.ts'
import { Announcer }               from '../../controls/announcer.tsx'
import { layers }                  from '../../controls/layers.tsx'
import { plotMarks }               from '../../controls/plot-marks.tsx'
import { PlotSlider, shareAcross } from '../../controls/plot-slider.ts'
import { Tablist, tabPanel }       from '../../controls/tablist.tsx'

import './styles/three-factors.css'

type Write = (minute: number) => void

const { axis, curve, factor, height, minutes, outside, range, rest, terms, track, upper, width } = data

const DRAWINGS = [curveDrawing, factorDrawing, rangeDrawing]
const LAST     = minutes.length - 1
const PLAY     = { from: 300, pace: 0.06, to: 810 }  // Minutes of the morning, and of the day per millisecond
const SWATCHES = [
  () => [
    <rect class="three-factors-sky" height={8} width={22} y={4} />,
    <path class="three-factors-sky-edge" d="M0 4.5H22" />
  ],
  () => [
    <path class="three-factors-share" d="M1 6H21" />,
    <circle class="three-factors-share-dot" cx={11} cy={6} r={2.6} />,
    <path class="three-factors-fall" d="M1 6H21" />
  ],
  () => [<circle class="three-factors-reading-dot" cx={11} cy={6} r={4} />]
]
const percents = minutes.map((_, minute) => `${minute / minutes.length * 100}%`)
const spoken   = minutes.map((clock, minute) => {
  const [clear, share, reading] = terms.map(({ figures }) => figures[minute]!)

  return `${clock}, ${clear} lux times ${share} gives ${reading} lux`
})
const tabs = terms.map(({ name }) => ({ label: name }))

/**
 * Holds the minute the three terms show, writing each figure and each mark
 * directly through strings built when the widget mounts, so a motion allocates
 * nothing as it moves.
 */
class FactorClock {
  readonly announcer = new Announcer()
  readonly id        = useId()
  readonly motion    = usePreferredReducedMotion()
  readonly playing   = shallowRef(false)
  readonly root      = shallowRef<HTMLElement>()
  readonly selected  = shallowRef(0)
  readonly slider    : PlotSlider
  #at                = rest
  readonly #glide    : Glide
  readonly #player   : FrameClock
  #started           = 0
  #track             : HTMLElement | undefined
  #writes            : readonly Write[] = []

  constructor() {
    this.#glide  = new Glide(rest, this.root, () => this.#settle(), (value) => this.#write(Math.round(value)))
    this.#player = new FrameClock(this.root, (now) => this.#advance(now))
    this.slider  = new PlotSlider({
      count    : minutes.length,
      page     : 60,
      position : (clientX) => this.#minuteAt(clientX),
      value    : () => this.#glide.goal,
      set      : (value, eased) => {
        this.pause()
        this.#glide.move(value, eased)
      }
    })

    onMounted(() => this.#mount())
    whenever(() => this.motion.value === 'reduce', () => this.pause())
  }

  pause(): void {
    if (!this.playing.value) return

    this.playing.value = false
    this.#player.stop()
    this.#settle()
  }

  toggle(): void {
    if (this.playing.value) {
      this.pause()

      return
    }

    const goal = this.#glide.goal

    if (goal < PLAY.from || goal >= PLAY.to) this.#glide.snap(PLAY.from)

    this.playing.value = true
    this.#started      = performance.now() - (this.#glide.goal - PLAY.from) / PLAY.pace
    this.#player.start()
  }

  #advance(now: number): boolean {
    const minute = PLAY.from + (now - this.#started) * PLAY.pace

    this.#glide.snap(Math.round(Math.min(minute, PLAY.to)))

    if (minute < PLAY.to) return true

    this.pause()

    return false
  }

  #minuteAt(clientX: number): number {
    return Math.round(shareAcross(this.#track!, clientX) * LAST)
  }

  #mount(): void {
    const root  = this.root.value!
    const named = <T extends Element>(name: string) => root.querySelector<T>(`.three-factors-${name}`)!

    const figures = [...root.querySelectorAll<HTMLElement>('.three-factors-big')]
    const sources = [...root.querySelectorAll<HTMLElement>('.three-factors-source')]

    this.#track  = named('track')
    this.#writes = [
      ...terms.flatMap((term, index) => [
        written(figures[index]!, term.figures),
        written(sources[index]!, term.sources)
      ]),
      ...curveMarks(named('altitude'), named('sun')),
      ...factorMarks(named('step')),
      ...rangeMarks(named('clear'), named('link'), named('reading'), named('under')),
      styled(named('thumb'), 'left', percents),
      attribute(this.#track, 'aria-valuenow', minutes.map((_, minute) => String(minute))),
      attribute(this.#track, 'aria-valuetext', spoken),
      (minute) => root.toggleAttribute('data-outside', outside[minute])
    ]
  }

  #settle(): void {
    if (!this.playing.value) this.announcer.say(spoken[this.#at]!)
  }

  #write(minute: number): void {
    if (minute === this.#at) return

    this.#at = minute

    for (const write of this.#writes) write(minute)
  }
}

/**
 * Sets the reading as one line of three terms, the clear sky times the cloud
 * factor equal to the reading, each term a tab opening its own drawing beneath
 * the line beside a sentence on where the figure comes from.
 */
export const ThreeFactors = defineComponent({
  name: 'ThreeFactors',
  setup() {
    const clock = new FactorClock()

    return () => (
      <div class="widget three-factors" ref={clock.root}>
        <Tablist
          id={clock.id}
          label="The terms of the reading"
          name="three-factors"
          onSelect={(index: number) => clock.selected.value = index}
          selected={clock.selected.value}
          tabs={tabs}
        >
          {{ default: termFace }}
        </Tablist>
        <div {...tabPanel(clock.id, clock.selected.value)} class="three-factors-slot">
          {layers(
            terms.map(({ label, note }, index) => (
              <div class="three-factors-layer">
                <div
                  aria-label={label}
                  class={`three-factors-plot three-factors-plot-${index}`}
                  role="img"
                  style={{ height: pixels(height) }}
                >
                  {...DRAWINGS[index]!()}
                </div>
                <p class="widget-note">{note}</p>
              </div>
            )),
            clock.selected.value
          )}
        </div>
        <div class="three-factors-control">
          <button
            aria-pressed={clock.playing.value}
            class="widget-pill"
            disabled={clock.motion.value === 'reduce'}
            onClick={() => clock.toggle()}
            type="button"
          >
            {clock.playing.value ? 'Pause' : 'Play the morning'}
          </button>
          <div class="three-factors-time">
            <div
              class="widget-track three-factors-track"
              {...clock.slider.attributes('Minute of the sample day', rest, spoken[rest])}
            >
              <span class="widget-rail" />
              <span
                class="three-factors-window"
                style={{ left: `${track.from}%`, width: `${track.to - track.from}%` }}
              />
              {...HOUR_MARKS.slice(1, -1).map((hour) => (
                <span class="widget-tick" style={{ left: hourLeft(hour) }} />
              ))}
              <span class="widget-thumb three-factors-thumb" style={{ left: percents[rest] }} />
            </div>
            <div aria-hidden class="three-factors-hours">
              {...HOUR_MARKS.map((hour) => <span style={{ left: hourLeft(hour) }}>{hourWord(hour)}</span>)}
            </div>
          </div>
        </div>
        {clock.announcer.region}
      </div>
    )
  }
})

function along(word: string, x: number): VNode {
  return <span class="three-factors-word three-factors-along" style={{ left: percentOf(x) }}>{word}</span>
}

function attribute(element: Element, name: string, values: readonly string[]): Write {
  return (minute) => element.setAttribute(name, values[minute]!)
}

function curveDrawing(): VNode[] {
  return [
    marks([
      <path class="three-factors-sky" d={curve.area} />,
      <path class="three-factors-sky-edge" d={curve.edge} />,
      <path class="three-factors-ceiling" d={`M0 ${curve.ceiling}H${width}`} />,
      <path class="three-factors-axis" d={`M0 ${axis}H${width}`} />,
      <path class="three-factors-altitude" d={tickAt(curve.x[rest]!, curve.y[rest]!)} />
    ]),
    ...curve.ticks.map(({ word, x }) => along(word, x)),
    dot('sun', curve.x[rest]!, curve.y[rest]!)
  ]
}

function curveMarks(altitude: SVGPathElement, sun: HTMLElement): Write[] {
  return [
    styled(sun, 'left', curve.x.map((x) => percentOf(x ?? 0))),
    styled(sun, 'top', curve.y.map(pixels)),
    styled(sun, 'visibility', curve.x.map(shownWhen)),
    attribute(altitude, 'd', curve.x.map((x, minute) => x === undefined ? '' : tickAt(x, curve.y[minute]!)))
  ]
}

function dot(name: string, x: number, y: number): VNode {
  return (
    <span class={`three-factors-dot three-factors-${name}`} style={{ left: percentOf(x), top: pixels(y) }} />
  )
}

function factorDrawing(): VNode[] {
  return [
    marks([
      <path class="three-factors-axis" d={`M0 ${axis}H${width}`} />,
      <path class="three-factors-grid" d={`M0 ${factor.grid}H${width}`} />,
      <path class="three-factors-fall" d={factor.fall} />,
      <path class="three-factors-share" d={factor.line} />
    ]),
    ...factor.steps.map(({ low, x, y }) => (
      <span class={['three-factors-mark', { low }]} style={{ left: percentOf(x), top: pixels(y) }} />
    )),
    ...factor.yWords.map(({ word, y }) => (
      <span class="three-factors-word three-factors-level" style={{ top: pixels(y) }}>{word}</span>
    )),
    ...factor.window.map(({ word, x }) => along(word, x)),
    dot('step', factor.x[rest]!, factor.y[rest]!)
  ]
}

function factorMarks(step: HTMLElement): Write[] {
  return [styled(step, 'left', factor.x.map(percentOf)), styled(step, 'top', factor.y.map(pixels))]
}

function hourLeft(hour: number): string {
  return `${hour / 24 * 100}%`
}

function linkAt(from: number, to: number): string {
  return `M${from} ${upper}L${to} ${axis}`
}

function marks(children: VNode[]): VNode {
  return plotMarks('three-factors-marks', width, height, children)
}

function percentOf(x: number): string {
  return `${x / width * 100}%`
}

function pixels(y: number): string {
  return `${y}px`
}

function rangeDrawing(): VNode[] {
  const [low, high] = range.ends

  return [
    marks([
      <path class="three-factors-axis" d={range.axis} />,
      <path class="three-factors-link" d={linkAt(range.clear[rest]!, range.reading[rest]!)} />
    ]),
    along(low, 0),
    along(high, width),
    <span class="three-factors-word three-factors-under" style={{ visibility: 'hidden' }}>
      {`◂ under ${low}`}
    </span>,
    dot('clear', range.clear[rest]!, upper),
    dot('reading', range.reading[rest]!, axis)
  ]
}

function rangeMarks(
  clear   : HTMLElement,
  link    : SVGPathElement,
  reading : HTMLElement,
  under   : HTMLElement
): Write[] {
  return [
    styled(clear, 'left', range.clear.map((x) => percentOf(x ?? 0))),
    styled(clear, 'visibility', range.clear.map(shownWhen)),
    styled(under, 'visibility', range.clear.map((x) => x === undefined ? 'visible' : 'hidden')),
    styled(reading, 'left', range.reading.map(percentOf)),
    attribute(link, 'd', range.reading.map((x, minute) => linkAt(range.clear[minute] ?? 0, x)))
  ]
}

function shownWhen(x: number | undefined): string {
  return x === undefined ? 'hidden' : 'visible'
}

function styled(
  element  : HTMLElement,
  property : 'left' | 'top' | 'visibility',
  values   : readonly string[]
): Write {
  return (minute) => {
    element.style[property] = values[minute]!
  }
}

function termFace({ index }: { index: number }): VNode[] {
  const { figures, name, sources, unit } = terms[index]!

  return [
    <span class="three-factors-name">
      <svg aria-hidden class="three-factors-swatch" viewBox="0 0 22 12">{...SWATCHES[index]!()}</svg>
      {name}
    </span>,
    <span class="three-factors-figure">
      <span class="three-factors-big">{figures[rest]}</span>
      <small class={{ 'three-factors-ghost': !unit }}>lux</small>
    </span>,
    <span class="three-factors-source">{sources[rest]}</span>
  ]
}

function tickAt(x: number, y: number): string {
  return `M${x} ${axis}V${y}`
}

function written(element: HTMLElement, values: readonly string[]): Write {
  return (minute) => {
    element.textContent = values[minute]!
  }
}
