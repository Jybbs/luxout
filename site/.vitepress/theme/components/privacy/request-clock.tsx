import { clamp }                                          from '@vueuse/core'
import { type VNode, defineComponent, shallowRef, useId } from 'vue'

import { tenth }                                from '../../../lib/daylight/tenth.ts'
import { FrameClock }                           from '../../../lib/motion/frame-clock.ts'
import { Speech }                               from '../../../lib/motion/speech.ts'
import { DURATIONS, motionReduced, smoothstep } from '../../../lib/motion/timing.ts'
import { data }                                 from '../../../lib/privacy/privacy.data.ts'
import type { ClockKey, ClockWord }             from '../../../lib/privacy/request-clock.ts'
import { layers }                               from '../../controls/layers.tsx'
import { Tablist, tabPanel }                    from '../../controls/tablist.tsx'

/**
 * The utilities the tabs beneath the face take.
 */
const CLASSES = {
  list: [
    'flex flex-wrap justify-center gap-x-5.5 border-b border-rule',
    '@max-lg:grid @max-lg:grid-flow-col @max-lg:gap-x-4'
  ],

  tab: [
    '-mb-px cursor-pointer border-b-2 border-transparent pt-1.5 pb-2 font-base text-[0.9rem]/[1.3]',
    'text-muted transition-[color,border-color] [transition-duration:var(--timing-hover),var(--timing-move)]',
    'data-selected:border-ink data-selected:text-ink @max-lg:text-[0.82rem]'
  ]
}
/**
 * The utilities of each mark on the face that shows only while the clock shows
 * a failed request, each fading in after the lag its index `--i` sets.
 */
const LATER = [
  'later opacity-0 transition-opacity duration-(--timing-fade)',
  'group-data-[on=fails]:opacity-100 group-data-[on=fails]:duration-(--timing-enter)',
  'group-data-[on=fails]:delay-[calc(var(--i)*var(--timing-lag))]'
]

const { clock } = data
const { radii } = clock

const CENTER = clock.side / 2
const FADES  = { in: 16, out: 28 }  // The face's units a dot fades over, past the core and before `far`
const QUIET  = 'transition-opacity duration-(--timing-fade) group-data-[on=fails]:opacity-0'
const tabs   = clock.states.map(({ name }) => ({ label: name }))

/**
 * Brings a state to the face by a journey along the hand, an ink dot leaving
 * the core past the request and off the face and a sea dot bringing the
 * forecast back into the core, whose words change as it lands, or for the
 * hour that fails, the dot stopping at the rim and nothing coming back.
 */
class Journey {
  readonly core     = shallowRef<HTMLElement>()
  readonly id       = useId()
  readonly on       = shallowRef<ClockKey | 'away'>(clock.states[0]!.key)
  readonly root     = shallowRef<HTMLElement>()
  readonly selected = shallowRef(0)
  readonly shown    = shallowRef(0)
  readonly speech   = new Speech(this.root)
  readonly #back    = shallowRef<SVGCircleElement>()
  readonly #frames  : FrameClock
  readonly #out     = shallowRef<SVGCircleElement>()
  #goal             : number | undefined
  #landed           = false
  #start            : number | undefined

  constructor() {
    this.#frames = new FrameClock(this.root, (now) => this.#step(now))
  }

  renderFace(): VNode {
    const [x, y] = clock.request

    return (
      <svg
        aria-hidden
        class="absolute inset-0 size-full overflow-visible"
        viewBox={`0 0 ${clock.side} ${clock.side}`}
      >
        <circle class="fill-none stroke-clock-scale stroke-[1.2]" cx={CENTER} cy={CENTER} r={radii.rim} />
        {...clock.minutes.map((d) => <path class="stroke-clock-scale stroke-1" d={d} />)}
        {...clock.ticks.map((d) => <path class="stroke-muted stroke-1" d={d} />)}
        <path class="stroke-ink stroke-[1.5] [stroke-linecap:round]" d={clock.hand} />
        {...clock.retries.map((d, index) => (
          <path
            class={['request-clock-retry stroke-ink stroke-[1.4] [stroke-linecap:round]', ...LATER]}
            d={d}
            style={{ '--i': index }}
          />
        ))}
        <circle
          class={[
            'fill-forecast stroke-ground stroke-[1.5] transition-[opacity,r]',
            '[transition-duration:var(--timing-fade),var(--timing-move)]',
            'group-data-[on=fails]:opacity-0 group-data-[on=sends]:[r:8px]'
          ]}
          cx={x}
          cy={y}
          r={6}
        />
        <path
          class={[
            'fill-none stroke-ink stroke-[1.8] [stroke-linecap:round] opacity-0 transition-opacity',
            'duration-(--timing-fade) group-data-[on=fails]:opacity-100'
          ]}
          d={clock.cross}
        />
        <circle class="fill-ink" opacity={0} r={4.5} ref={this.#out} />
        <circle class="request-clock-reply fill-forecast" opacity={0} r={4.5} ref={this.#back} />
      </svg>
    )
  }

  select(index: number): void {
    this.selected.value = index
    this.speech.say(clock.states[index]!.text)
    this.send()
  }

  /**
   * Starts the journey that brings the chosen state to the face, or lands it
   * at once under reduced motion.
   */
  send(): void {
    if (motionReduced()) {
      this.#land(this.selected.value)

      return
    }

    this.#goal     = this.selected.value
    this.#landed   = false
    this.#start    = undefined
    this.on.value  = 'away'
    this.#frames.start()
  }

  #land(index: number): void {
    this.#frames.stop()
    this.#goal        = undefined
    this.shown.value  = index
    this.on.value     = clock.states[index]!.key
    this.#out.value?.setAttribute('opacity', '0')
    this.#back.value?.setAttribute('opacity', '0')
    this.core.value?.style.removeProperty('opacity')
  }

  /**
   * Sets `dot` at `radius` on the request's minute, fading it in as it leaves
   * the core and out as it leaves the face.
   */
  #place(dot: SVGCircleElement, radius: number, on: boolean): void {
    const [x, y] = clock.heading
    const rising = clamp((radius - radii.core) / FADES.in, 0, 1)
    const shown  = rising * clamp((radii.far - radius) / FADES.out, 0, 1)

    dot.setAttribute('cx', String(tenth(CENTER + radius * x)))
    dot.setAttribute('cy', String(tenth(CENTER + radius * y)))
    dot.setAttribute('opacity', on ? String(tenth(shown)) : '0')
  }

  /**
   * Moves each leg's dot along smoothstep over the settle duration, with the
   * hover duration at Open-Meteo between the legs, fading the core's words
   * out before the dot lands and back in over the enter duration after.
   */
  #step(now: number): boolean {
    const goal = this.#goal

    if (goal === undefined) return false

    if (motionReduced()) {
      this.#land(goal)

      return false
    }

    this.#start ??= now

    const { enter, fade, hover, settle: leg } = DURATIONS

    const at    = now - this.#start
    const fails = clock.states[goal]!.key === 'fails'
    const out   = fails ? leg * (radii.rim - radii.core) / (radii.far - radii.core) : leg
    const due   = fails ? out : 2 * leg + hover
    const reach = fails ? radii.rim : radii.far
    const core  = this.core.value!

    this.#place(this.#out.value!, radii.core + (reach - radii.core) * smoothstep(at / out), at < out)

    const back = radii.far - (radii.far - radii.core) * smoothstep((at - due + leg) / leg)

    this.#place(this.#back.value!, back, !fails && at > due - leg && at < due)

    if (at < due) {
      core.style.opacity = String(tenth(1 - smoothstep((at - due + fade) / fade)))

      return true
    }

    if (!this.#landed) {
      this.#landed     = true
      this.shown.value = goal
      this.on.value    = clock.states[goal]!.key
    }

    const entered = (at - due) / enter

    if (entered < 1) {
      core.style.opacity = String(tenth(smoothstep(entered)))

      return true
    }

    this.#land(goal)

    return false
  }
}

/**
 * Draws one hour of the fetch schedule as a clock face, its tabs switching
 * between how often the plugin asks, what each request carries, and an hour
 * whose request fails, each choice sending the request out along the hand.
 */
export const RequestClock = defineComponent({
  name: 'RequestClock',
  setup() {
    const journey = new Journey()

    return () => {
      const state = clock.states[journey.shown.value]!

      return (
        <div class="widget grid justify-items-center gap-3.5" ref={journey.root}>
          <div
            aria-label={clock.label}
            class="request-clock-face group relative aspect-square w-full max-w-64 @container"
            data-on={journey.on.value}
            role="img"
          >
            {journey.renderFace()}
            <div aria-hidden class="pointer-events-none absolute inset-0">
              {...clock.quarters.map((word) => hourWord(word, ['text-muted', word.quiet && QUIET]))}
              {...clock.said.map((word, index) => hourWord(word, ['said text-ink', ...LATER], index))}
            </div>
            <div
              aria-hidden
              class={[
                'request-clock-core pointer-events-none absolute inset-[30%] grid place-content-center',
                'justify-items-center gap-1 text-center'
              ]}
              ref={journey.core}
            >
              <b
                class={[
                  'whitespace-pre-line tabular-nums',
                  state.figures
                    ? 'font-mono text-[clamp(1rem,7.2cqi,1.2rem)]/[1.2] font-medium'
                    : 'font-display text-[clamp(1.3rem,10cqi,1.85rem)]/none font-semibold lining-nums'
                ]}
              >
                {state.big}
              </b>
              <span class="max-w-32 text-[0.74rem]/[1.35] text-muted">{state.small}</span>
            </div>
            <span
              aria-hidden
              class="request-clock-send absolute size-10 -translate-1/2 cursor-pointer rounded-full"
              onClick={() => journey.send()}
              style={at(clock.request)}
            />
          </div>
          <Tablist
            classes={CLASSES}
            id={journey.id}
            label="What the clock face shows"
            onSelect={(index: number) => journey.select(index)}
            selected={journey.selected.value}
            tabs={tabs}
          >
            {{ default: ({ index }: { index: number }) => clock.states[index]!.name }}
          </Tablist>
          <div
            {...tabPanel(journey.id, journey.selected.value)}
            class="request-clock-panel w-full max-w-120 text-center [&_p]:m-0 [&_p]:text-[0.95rem]/[1.55]"
          >
            {layers(clock.states.map(({ text }) => <p>{text}</p>), journey.selected.value)}
          </div>
        </div>
      )
    }
  }
})

function at([x, y]: readonly [x: number, y: number]): Record<string, string> {
  return { left: `${tenth(x / clock.side * 100)}%`, top: `${tenth(y / clock.side * 100)}%` }
}

function hourWord(
  { left, top, word } : ClockWord,
  classes             : (false | string | undefined)[],
  index?              : number
): VNode {
  const style = { left: `${left}%`, top: `${top}%`, ...index === undefined ? {} : { '--i': index } }

  return (
    <span
      class={[
        'request-clock-hour absolute -translate-1/2 font-mono text-[0.62rem]/none font-medium tabular-nums',
        ...classes
      ]}
      style={style}
    >
      {word}
    </span>
  )
}
