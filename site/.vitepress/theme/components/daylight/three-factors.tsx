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

type Write = (minute: number) => void

const { axis, curve, factor, height, minutes, outside, range, rest, terms, track, upper, width } = data

const AXIS = 'fill-none stroke-muted stroke-1'
/**
 * The utilities the tablist and each of its terms take, the terms in one row
 * joined by their signs and stacked once the widget narrows.
 */
const CLASSES = {
  list: [
    'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-x-1.5',
    'gap-y-1 before:col-start-2 before:row-start-1 before:self-center before:justify-self-center',
    'before:font-mono before:text-[1.05rem]/none before:font-medium before:text-ink',
    "before:content-['×'_/_'']",
    'after:col-start-4 after:row-start-1 after:self-center after:justify-self-center after:font-mono',
    "after:text-[1.05rem]/none after:font-medium after:text-ink after:content-['='_/_'']",
    '@max-md:grid-cols-[1.2rem_minmax(0,1fr)] @max-md:gap-x-1 @max-md:gap-y-0.5 @max-md:before:col-start-1',
    '@max-md:before:row-start-2 @max-md:after:col-start-1 @max-md:after:row-start-3'
  ],
  tab: [
    'grid min-w-0 content-start gap-1 rounded-lg px-3 pt-2.5 pb-3 text-left text-ink',
    'shadow-[inset_0_-1.5px_0_transparent] transition-[background-color,box-shadow]',
    'duration-(--timing-hover)',
    'hover:bg-raised aria-selected:bg-raised aria-selected:shadow-[inset_0_-1.5px_0_var(--color-ink)]',
    '@md:nth-of-type-1:col-start-1 @md:nth-of-type-2:col-start-3 @md:nth-of-type-3:col-start-5',
    '@max-md:col-start-2 @max-md:grid-cols-[minmax(0,1fr)_auto] @max-md:items-baseline @max-md:gap-x-3',
    '@max-md:gap-y-0.5 @max-md:px-2.5 @max-md:pt-2 @max-md:pb-2.25'
  ]
}
/**
 * The utilities sizing and filling each dot a drawing moves across its plot.
 */
const DOTS = {
  clear   : 'size-2 bg-sky ring-[1.5px] ring-ink',
  reading : 'size-[9px] bg-estimate ring-[1.5px] ring-ground',
  step    : 'size-2 bg-forecast ring-[1.5px] ring-ground group-data-outside:bg-fallback',
  sun     : 'size-2 bg-sky ring-[1.5px] ring-ink'
}
const DRAWINGS = [curveDrawing, factorDrawing, rangeDrawing]
const EDGE     = 'fill-none stroke-ink stroke-[1.1] [stroke-linejoin:round]'
const FALL     = 'fill-none stroke-fallback stroke-[1.5] [stroke-dasharray:4_3]'
const PLAY     = { from: 300, pace: 0.06, to: 810 }  // Minutes of the morning, and of the day per millisecond
const PLOTS    = ['', 'ms-[1.6rem]', 'mx-2']
const SHARE    = 'fill-none stroke-forecast stroke-[1.5] [stroke-linejoin:round]'
const SPOT     = 'absolute -translate-x-1/2 -translate-y-1/2 rounded-full'
const WORD     = 'absolute font-mono text-[0.64rem]/none font-medium whitespace-nowrap tabular-nums '
               + 'text-muted'
const LAST     = minutes.length - 1
const SWATCHES = [
  () => [
    <rect class="fill-sky-fill" height={8} width={22} y={4} />,
    <path class={EDGE} d="M0 4.5H22" />
  ],
  () => [
    <path class={[SHARE, 'group-data-outside:hidden']} d="M1 6H21" />,
    <circle class="fill-forecast group-data-outside:hidden" cx={11} cy={6} r={2.6} />,
    <path class={[FALL, 'hidden group-data-outside:inline']} d="M1 6H21" />
  ],
  () => [<circle class="fill-estimate stroke-ground stroke-[1.5]" cx={11} cy={6} r={4} />]
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
      <div class="widget three-factors group grid gap-4" ref={clock.root}>
        <Tablist
          classes={CLASSES}
          id={clock.id}
          label="The terms of the reading"
          onSelect={(index: number) => clock.selected.value = index}
          selected={clock.selected.value}
          tabs={tabs}
        >
          {{ default: termFace }}
        </Tablist>
        <div
          {...tabPanel(clock.id, clock.selected.value)}
          class="three-factors-slot border-t border-rule pt-3"
        >
          {layers(
            terms.map(({ label, note }, index) => (
              <div class="grid content-start gap-2">
                <div
                  aria-label={label}
                  class={['three-factors-plot relative', PLOTS[index]]}
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
        <div
          class={[
            'grid grid-cols-[9.5rem_minmax(0,1fr)] items-start gap-4 border-t border-rule pt-3',
            '@max-md:grid-cols-[minmax(0,1fr)] @max-md:gap-2'
          ]}
        >
          <button
            aria-pressed={clock.playing.value}
            class={[
              'widget-pill inline-flex cursor-pointer items-center justify-self-start',
              'transition-[background-color] duration-(--timing-hover)',
              'aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-ground'
            ]}
            disabled={clock.motion.value === 'reduce'}
            onClick={() => clock.toggle()}
            type="button"
          >
            {clock.playing.value ? 'Pause' : 'Play the morning'}
          </button>
          <div class="grid min-w-0 gap-0.5">
            <div
              class="widget-track three-factors-track"
              {...clock.slider.attributes('Minute of the sample day', rest, spoken[rest])}
            >
              <span class="widget-rail" />
              <span
                class="three-factors-window absolute top-[13px] h-0.5 rounded-[1px] bg-forecast"
                style={{ left: `${track.from}%`, width: `${track.to - track.from}%` }}
              />
              {...HOUR_MARKS.slice(1, -1).map((hour) => (
                <span class="widget-tick" style={{ left: hourLeft(hour) }} />
              ))}
              <span class="widget-thumb three-factors-thumb" style={{ left: percents[rest] }} />
            </div>
            <div aria-hidden class="relative h-3.5">
              {...HOUR_MARKS.map((hour) => (
                <span
                  class={[
                    'absolute top-0 -translate-x-1/2 font-mono text-[0.64rem]/none font-medium text-muted',
                    'first:translate-x-0 last:-translate-x-full'
                  ]}
                  style={{ left: hourLeft(hour) }}
                >
                  {hourWord(hour)}
                </span>
              ))}
            </div>
          </div>
        </div>
        {clock.announcer.region}
      </div>
    )
  }
})

function along(word: string, x: number, shift = '-translate-x-1/2'): VNode {
  return <span class={[WORD, 'bottom-0.5', shift]} style={{ left: percentOf(x) }}>{word}</span>
}

function attribute(element: Element, name: string, values: readonly string[]): Write {
  return (minute) => element.setAttribute(name, values[minute]!)
}

function curveDrawing(): VNode[] {
  return [
    marks([
      <path class="fill-sky-fill" d={curve.area} />,
      <path class={EDGE} d={curve.edge} />,
      <path
        class="fill-none stroke-muted stroke-1 [stroke-dasharray:3_3]"
        d={`M0 ${curve.ceiling}H${width}`}
      />,
      <path class={AXIS} d={`M0 ${axis}H${width}`} />,
      <path
        class="three-factors-altitude stroke-geometry stroke-1 [stroke-dasharray:2_2]"
        d={tickAt(curve.x[rest]!, curve.y[rest]!)}
      />
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

function dot(name: keyof typeof DOTS, x: number, y: number): VNode {
  return (
    <span
      class={[`three-factors-${name}`, SPOT, DOTS[name]]}
      style={{ left: percentOf(x), top: pixels(y) }}
    />
  )
}

function factorDrawing(): VNode[] {
  return [
    marks([
      <path class={AXIS} d={`M0 ${axis}H${width}`} />,
      <path class="stroke-rule stroke-1" d={`M0 ${factor.grid}H${width}`} />,
      <path class={FALL} d={factor.fall} />,
      <path class={SHARE} d={factor.line} />
    ]),
    ...factor.steps.map(({ low, x, y }) => (
      <span
        class={[
          SPOT,
          'size-[4.4px]',
          low ? 'bg-ground ring-[1.2px] ring-geometry' : 'bg-forecast'
        ]}
        style={{ left: percentOf(x), top: pixels(y) }}
      />
    )),
    ...factor.yWords.map(({ word, y }) => (
      <span class={[WORD, 'right-[calc(100%+6px)] -translate-y-1/2']} style={{ top: pixels(y) }}>{word}</span>
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
  return plotMarks(
    'absolute inset-0 size-full overflow-visible [&_path]:[vector-effect:non-scaling-stroke]',
    width,
    height,
    children
  )
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
      <path class={AXIS} d={range.axis} />,
      <path
        class="three-factors-link fill-none stroke-muted stroke-1 [stroke-dasharray:2_3]"
        d={linkAt(range.clear[rest]!, range.reading[rest]!)}
      />
    ]),
    along(low, 0, '-translate-x-2'),
    along(high, width, '-translate-x-[calc(100%-8px)]'),
    <span class={['three-factors-under', WORD, 'top-16 -left-2']} style={{ visibility: 'hidden' }}>
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
    <span class="inline-flex min-w-0 items-center gap-1.75 text-[0.82rem]/[1.3] whitespace-nowrap text-muted">
      <svg aria-hidden class="h-3 w-5.5 flex-none" viewBox="0 0 22 12">{...SWATCHES[index]!()}</svg>
      {name}
    </span>,
    <span class="flex items-baseline gap-1.25 whitespace-nowrap">
      <span
        class={[
          'three-factors-big font-display text-2xl/[1.1] font-semibold whitespace-nowrap lining-nums',
          'tabular-nums'
        ]}
      >
        {figures[rest]}
      </span>
      <small class={['font-mono text-[0.7rem]/none font-medium text-muted', { invisible: !unit }]}>lux</small>
    </span>,
    <span
      class={[
        'three-factors-source min-h-[2lh] text-[0.8rem]/[1.35] text-balance text-muted @max-md:col-span-full',
        '@max-md:min-h-[1lh]'
      ]}
    >
      {sources[rest]}
    </span>
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
