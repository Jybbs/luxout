import { noop, useResizeObserver } from '@vueuse/core'
import { range }                   from 'd3-array'
import { type VNode, defineComponent, onMounted, shallowRef, useId, watch } from 'vue'

import { TWILIGHT }                      from '../../../../../src/daylight/clear-sky.ts'
import { DAY_MINUTES, HOUR_MINUTES }     from '../../../lib/daylight/clock.ts'
import { formatClock }                   from '../../../lib/daylight/format.ts'
import type { Facts }                    from '../../../lib/front/facts.ts'
import { data }                          from '../../../lib/front/front.data.ts'
import { useFrontFacts, useFrontMinute } from '../../../lib/front/minute.ts'
import { Readout }                       from '../../../lib/front/readout.ts'
import { FrameClock }                    from '../../../lib/motion/frame-clock.ts'
import { Glide }                         from '../../../lib/motion/glide.ts'
import { Speech }                        from '../../../lib/motion/speech.ts'
import { smoothstep }                    from '../../../lib/motion/timing.ts'
import { OVERLAY, PlotSlider }           from '../../controls/plot-slider.tsx'

const { date, day, place, strip } = data

const ASSUMED = ['Clear sky assumed', 'Assumed'] as const
const CARD    = { gap: 12, near: 20, reach: 32 }  // Pixels between the card, the scene's ends, and the beam
const CHIP    = 'h-4.5 rounded-[9px] bg-sunken px-1.75 font-mono text-[0.6875rem]/[18px] font-medium '
              + 'tracking-[0.05em] whitespace-nowrap text-ink uppercase '
              + 'shadow-[inset_0_0_0_1px_var(--color-rule)]'
/**
 * The pixels the cloud's ends round over, the pixels it drifts each second, and
 * its colors from the top down.
 */
const CLOUD   = { cap: 6, drift: 7, shades: ['#faf9f6f7', '#bcb8b0f7'] }
const FACE    = 'font-mono text-[0.6875rem]/[1.3] font-medium tracking-[0.05em] whitespace-nowrap uppercase'
const FIGURE  = 'font-display text-[1.05rem]/[1.1] font-semibold whitespace-nowrap lining-nums tabular-nums'
const LABEL   = `A cross-section of the sky over ${place} through ${date}, shaded above the cloud deck `
              + 'by the clear sky’s lux on a log scale and below it by the forecast’s, with the '
              + 'morning’s clouds as thick as the share of light they hold back and the light beneath '
              + 'them grayed by that share'
/**
 * The pixels the stars keep inside the sky above the deck.
 */
const STAR    = { top: 6, under: 16 }
const stars   = {
  phase : Float32Array.from(strip.stars, ({ phase }) => phase),
  rate  : Float32Array.from(strip.stars, ({ rate }) => rate),
  shine : Float32Array.from(strip.stars, ({ shine }) => shine),
  size  : Float32Array.from(strip.stars, ({ size }) => size)
}
const ats     = range(DAY_MINUTES + 1).map((minute) => (minute / DAY_MINUTES).toFixed(5))
const glows   = range(DAY_MINUTES + 1).map((minute) => {
  const sky   = glowOf(day.clearSkies[minute]!)
  const under = glowOf(day.readings[minute]!)

  return [sky, (sky + under) / 2, under].map((value) => value.toFixed(2))
})
const [from, to] = day.window
const crossings  = [['Sunrise', day.rise], ['Sunset', day.set]] as const

/**
 * Paints the stars of the night and the morning's drifting clouds over the
 * Day Strip's sky, holding every figure a frame reads in arrays built on each
 * resize, so a frame allocates nothing.
 */
class StripSky {
  #cloud   = { thick: new Float32Array(), x: new Float32Array() }
  #context : CanvasRenderingContext2D | undefined
  #middle  = 0
  #shade   : CanvasGradient | undefined
  #stars   = { x: new Float32Array(), y: new Float32Array() }

  /**
   * Paints the scene `now` milliseconds into the clock, each star twinkling at
   * its own rate and the clouds' scalloped tops drifting along the deck while
   * their depth stays the share of light they hold back.
   */
  paint(now: number): void {
    const context = this.#context

    if (!context) return

    const seconds = now / 1000
    const drift   = seconds * CLOUD.drift
    const { thick, x } = this.#cloud

    context.clearRect(0, 0, context.canvas.width, context.canvas.height)
    context.fillStyle = strip.star

    for (let index = 0; index < stars.size.length; index++) {
      const twinkle = Math.sin(seconds * stars.rate[index]! + stars.phase[index]!)

      context.globalAlpha = stars.shine[index]! * (0.62 + 0.38 * twinkle)
      context.beginPath()
      context.arc(this.#stars.x[index]!, this.#stars.y[index]!, stars.size[index]!, 0, 2 * Math.PI)
      context.fill()
    }

    context.globalAlpha = 1

    if (!x.length) return

    context.fillStyle = this.#shade!
    context.beginPath()

    for (let index = 0; index < x.length; index++) {
      const column = x[index]!
      const depth  = thick[index]!

      context.lineTo(column, this.#middle - depth / 2 - depth * 0.5 * puff(column - drift, 7.5))
    }

    for (let index = x.length - 1; index >= 0; index--) {
      const column = x[index]!
      const depth  = thick[index]!

      context.lineTo(column, this.#middle + depth / 2 + depth * 0.15 * puff(column + 3 - drift, 5))
    }

    context.closePath()
    context.fill()
  }

  /**
   * Sizes the canvas to `width` by `height` pixels at the screen's density, up
   * to two device pixels to one.
   */
  resize(canvas: HTMLCanvasElement, width: number, height: number): void {
    const density = Math.min(2, devicePixelRatio)
    const deck    = height * strip.layers.deck
    const under   = height * strip.layers.under
    const ends    = [from, to].map((minute) => minute / DAY_MINUTES * width) as [number, number]
    const columns = range(Math.ceil(ends[0]), Math.floor(ends[1]) + 1)

    canvas.width  = Math.round(width * density)
    canvas.height = Math.round(height * density)

    this.#context = canvas.getContext('2d') ?? undefined
    this.#context?.setTransform(density, 0, 0, density, 0, 0)
    this.#middle  = (deck + under) / 2
    this.#shade   = this.#context?.createLinearGradient(0, deck, 0, under)
    this.#stars   = {
      x : Float32Array.from(strip.stars, ({ u }) => u * width),
      y : Float32Array.from(strip.stars, ({ v }) => STAR.top + v * (deck - STAR.under))
    }
    this.#cloud   = {
      thick : Float32Array.from(columns, (x) => {
        const minute = Math.round(x / width * DAY_MINUTES)
        const cap    = smoothstep((x - ends[0]) / CLOUD.cap) * smoothstep((ends[1] - x) / CLOUD.cap)

        return (1 - (day.factors[minute] ?? 1)) * 2 * (under - deck) * cap
      }),
      x     : Float32Array.from(columns)
    }

    for (const [index, color] of CLOUD.shades.entries()) this.#shade?.addColorStop(index, color)
  }
}

/**
 * Holds the Day Strip's minute, writing the beam, the sun, and the card's
 * figures straight to the page from values built ahead of any motion, and
 * keeping the card at one end of the scene clear of the beam.
 */
class StripScene {
  readonly id      = useId()
  readonly root    = shallowRef<HTMLElement>()
  readonly slider  : PlotSlider
  readonly speech  = new Speech(this.root)
  readonly stage   = shallowRef<HTMLElement>()
  #card            : HTMLElement | undefined
  #end             : 'left' | 'right' = 'right'
  readonly #facts  = useFrontFacts()
  readonly #glide  : Glide
  #glows           : HTMLElement[] = []
  readonly #minute = useFrontMinute()
  #readout         : Readout | undefined
  readonly #sky    = new StripSky()
  #sun             : HTMLElement | undefined
  #width           = 0

  constructor() {
    this.#glide = new Glide(this.#minute.value, this.root, noop, (minute) => { this.#minute.value = minute })
    this.slider = new PlotSlider({
      count : DAY_MINUTES + 1,
      label : `Minute of ${date}`,
      page  : 60,
      set   : (minute, eased) => this.#glide.move(minute, eased),
      text  : (minute) => {
        const { clear, reading, sun, time } = this.#facts[minute]!

        return `${time}, sun at ${sun}, clear sky ${clear} lux, forecast ${reading} lux`
      },
      value : () => Math.round(this.#minute.value)
    })

    onMounted(() => this.#mount())
  }

  /**
   * Keeps the card at the right end of the scene until the beam comes within
   * its reach, then at the left end until the beam comes within reach of that
   * end, so the card never sits under the beam and never swaps back and forth.
   */
  #dock(minute: number): void {
    const card  = this.#card!.offsetWidth
    const x     = minute / DAY_MINUTES * this.#width
    const right = this.#width - card - CARD.gap
    const end   = this.#end === 'right'
      ? x > right - CARD.near ? 'left' : 'right'
      : x < card + CARD.reach ? 'right' : 'left'

    if (end === this.#end) return

    this.#end = end
    this.#card!.dataset.end = end
  }

  #draw(at: number): void {
    const minute = Math.round(at)
    const facts  = this.#facts[minute]!

    this.stage.value!.style.setProperty('--at', ats[minute]!)

    for (const [index, glow] of this.#glows.entries()) glow.style.opacity = glows[minute]![index]!

    this.#sun!.toggleAttribute('data-down', day.altitudes[minute]! < TWILIGHT.sunset)
    this.#readout!.write(facts)
    this.#dock(minute)
    this.speech.say(`${facts.time}, ${facts.phase.toLowerCase()}, clear sky ${facts.clear} lux, `
                  + `forecast ${facts.reading} lux`)
  }

  #mount(): void {
    const stage  = this.stage.value!
    const canvas = stage.querySelector('canvas')!
    const clock  = new FrameClock(stage, (now) => {
      this.#sky.paint(now)

      return true
    })

    this.#card    = this.root.value!.querySelector<HTMLElement>('.day-strip-card')!
    this.#glows   = [...stage.querySelectorAll<HTMLElement>('.day-strip-glow')]
    this.#readout = new Readout(this.#card)
    this.#sun     = stage.querySelector<HTMLElement>('.day-strip-sun')!

    useResizeObserver(stage, ([entry]) => {
      const { height, width } = entry!.contentRect

      this.#width = width
      this.#sky.resize(canvas, width, height)
      this.#sky.paint(clock.now())
      stage.toggleAttribute('data-painted', true)
      this.#draw(this.#minute.value)
    })
    watch(this.#minute, (minute) => this.#draw(minute))
    clock.start()
  }
}

/**
 * Draws a cross-section of the sky over the sample day, the clear sky above
 * the cloud deck and the forecast below it, with a sunbeam a reader moves
 * through the day and a card reading out the minute it stands on.
 */
export const DayStrip = defineComponent({
  name: 'DayStrip',
  setup() {
    const scene = new StripScene()
    const at    = useFrontFacts()[day.noon]!
    const id    = (name: string) => `${scene.id}-${name}`

    return () => (
      <figure class="widget day-strip my-0" ref={scene.root}>
        <figcaption class="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <span class={[FACE, 'text-ink']}>{`${place} · ${date}`}</span>
          <span class="text-[0.86rem]/[1.4] text-muted italic">
            The clouds as thick as the light they hold back
          </span>
        </figcaption>
        <div class="day-strip-grid grid">
          <div class="day-strip-stage relative" ref={scene.stage} style={{ '--at': ats[day.noon] }}>
            {scene.slider.render(OVERLAY, () => [
              <div aria-label={LABEL} class="absolute inset-0 overflow-hidden rounded-t-lg" role="img">
                <svg
                  class="absolute inset-0 size-full"
                  preserveAspectRatio="none"
                  viewBox={`0 0 ${DAY_MINUTES} 100`}
                >
                  <defs>
                    {gradient(id('clear'), strip.clear)}
                    {gradient(id('forecast'), strip.forecast)}
                    <linearGradient
                      gradientUnits="userSpaceOnUse"
                      id={id('fade')}
                      x1="0"
                      x2="0"
                      y1={100 * strip.layers.deck}
                      y2={100 * strip.layers.under}
                    >
                      <stop offset="0" stop-color="#fff" />
                      <stop offset="1" stop-color="#000" />
                    </linearGradient>
                    <mask id={id('mask')}>
                      <rect fill={`url(#${id('fade')})`} height="100" width={DAY_MINUTES} />
                    </mask>
                    <linearGradient id={id('cloud')} x1="0" x2="0" y1="0" y2="1">
                      {...CLOUD.shades.map((color, index) => <stop offset={index} stop-color={color} />)}
                    </linearGradient>
                  </defs>
                  <rect fill={`url(#${id('forecast')})`} height="100" width={DAY_MINUTES} />
                  <rect
                    fill={`url(#${id('clear')})`}
                    height="100"
                    mask={`url(#${id('mask')})`}
                    width={DAY_MINUTES}
                  />
                  <path class="day-strip-cloud" d={strip.cloud} fill={`url(#${id('cloud')})`} />
                </svg>
                <canvas aria-hidden class="absolute inset-0 size-full" />
              </div>,
              <span aria-hidden class="day-strip-beam">
                {...['sky', 'deck', 'under'].map((layer, index) => (
                  <i
                    class={`day-strip-glow day-strip-glow-${layer}`}
                    style={{ opacity: glows[day.noon]![index] }}
                  />
                ))}
                <i class="day-strip-needle" />
              </span>,
              <span aria-hidden class="day-strip-sun" />
            ])}
          </div>
          {card(at)}
          <div aria-hidden class="day-strip-axis grid gap-1.5 border-t border-ink pt-2">
            {lane()}
            {scale()}
          </div>
        </div>
      </figure>
    )
  }
})

function card(at: Facts): VNode {
  const level = 'day-strip-level grid justify-items-start gap-0.75'
  const unit  = (text: string) => <span class="font-mono text-[0.6875rem]/none text-muted">{text}</span>
  const sign  = (fact: 'beyond' | null, mark: string) => (
    <span class="mr-0.75 font-mono text-[1em]/none font-semibold" data-fact={fact ?? undefined}>{mark}</span>
  )

  return (
    <div aria-hidden class="day-strip-card group" data-end="right">
      <span class="day-strip-level day-strip-head flex items-baseline justify-between gap-2">
        <b class="widget-time" data-fact="time">{at.time}</b>
        <span class="font-mono text-[0.6875rem]/none text-muted tabular-nums">
          Sun <span data-fact="sun">{at.sun}</span>
        </span>
      </span>
      <span class={[level, 'day-strip-sky']}>
        <span class={[FACE, 'text-muted']}>Clear sky</span>
        <span class={FIGURE}>
          {sign('beyond', at.beyond)}<span data-fact="clear">{at.clear}</span>{unit(' lux')}
        </span>
      </span>
      <span class={[level, 'day-strip-deck']}>
        <span class={[FACE, 'text-muted']}>Cloud factor</span>
        <span class={FIGURE}>
          {sign(null, '×')}<span data-fact="factor">{at.factor ?? '1'}</span>
          <span class="hidden group-data-assumed:inline">{unit(' assumed')}</span>
        </span>
      </span>
      <span class={[level, 'day-strip-under']}>
        <span class={[FACE, 'text-muted']}>Forecast</span>
        <span class={FIGURE}><span data-fact="reading">{at.reading}</span>{unit(' lux')}</span>
      </span>
    </div>
  )
}

function glowOf(lux: number): number {
  return 0.14 + 0.62 * Math.cbrt(lux / 1e5)
}

function gradient(id: string, colors: readonly string[]): VNode {
  return (
    <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
      {...colors.map((color, index) => (
        <stop offset={(index / (colors.length - 1)).toFixed(4)} stop-color={color} />
      ))}
    </linearGradient>
  )
}

/**
 * Lays the forecast window's lane under the horizon, with the window and the
 * spans either side of it each named by the longest of its names that fits.
 */
function lane(): VNode {
  const spans = [
    { from: 0, names: ASSUMED, to: from, window: false },
    { from, names: ['Forecast window', 'Window'], to, window: true },
    { from: to, names: ASSUMED, to: DAY_MINUTES, window: false }
  ]

  return (
    <div class="relative h-4.5">
      {...spans.map(({ from: start, names: [long, short], to: end, window }) => (
        <span
          class={[
            'day-strip-span @container absolute inset-y-0 flex items-center justify-center',
            window ? 'day-strip-window' : 'day-strip-assumed'
          ]}
          style={{ left: percent(start), width: percent(end - start) }}
        >
          <span class={[CHIP, 'relative @max-xs:hidden']}>{long}</span>
          <span class={[CHIP, 'relative hidden @max-xs:inline @max-2xs:hidden']}>{short}</span>
        </span>
      ))}
    </div>
  )
}

function percent(minute: number): string {
  return `${(minute / DAY_MINUTES * 100).toFixed(3)}%`
}

function puff(x: number, length: number): number {
  return Math.abs(Math.sin(x / length)) ** 0.7
}

/**
 * Lays the scale under the lane: a tick at every hour, the hour's figure every
 * third hour, and each of the sun's crossings under a tick and a chip of its
 * own, which names the crossing beside its time on a wide strip.
 */
function scale(): VNode {
  const last = strip.hours.length - 1

  return (
    <div class="relative h-7">
      {...range(0, DAY_MINUTES + 1, HOUR_MINUTES).map((minute) => (
        <i
          class={[
            'absolute top-0 w-px -translate-x-1/2',
            minute % (3 * HOUR_MINUTES) ? 'h-1 bg-muted' : 'h-1.75 bg-ink'
          ]}
          style={{ left: percent(minute) }}
        />
      ))}
      {...strip.hours.map(({ at, near, word }, index) => (
        <span
          class={[
            'absolute top-2.5 font-mono text-[0.6875rem]/[18px] text-muted tabular-nums',
            index === 0 ? '' : index === last ? '-translate-x-full' : '-translate-x-1/2',
            { '@max-lg:hidden': near }
          ]}
          style={{ left: percent(at) }}
        >
          {word}
        </span>
      ))}
      {...crossings.map(([name, minute]) => (
        <span
          class="absolute top-0 -translate-x-1/2 pt-2.5 whitespace-nowrap"
          style={{ left: percent(minute) }}
        >
          <i class="absolute top-0 left-1/2 h-2 w-0.5 -translate-x-1/2 bg-geometry" />
          <span class={CHIP}>
            <span class="hidden lg:inline">{`${name} `}</span>
            {formatClock(minute)}
          </span>
        </span>
      ))}
    </div>
  )
}
