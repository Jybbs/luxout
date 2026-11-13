import { clamp }                                             from '@vueuse/core'
import { type VNode, defineComponent, h, shallowRef, useId } from 'vue'

import { tenth }                                from '../../../lib/daylight/tenth.ts'
import { FrameClock }                           from '../../../lib/motion/frame-clock.ts'
import { DURATIONS, motionReduced, smoothstep } from '../../../lib/motion/timing.ts'
import { data }                                 from '../../../lib/privacy/privacy.data.ts'
import { type ClockKey, type ClockWord, RADII } from '../../../lib/privacy/request-clock.ts'
import { Announcer }                            from '../../controls/announcer.ts'
import { layers }                               from '../../controls/layers.ts'
import { Tablist, tabPanel }                    from '../../controls/tablist.ts'

import './styles/request-clock.css'

const { clock } = data

const CENTER = clock.side / 2
const FADES  = { in: 16, out: 28 }  // The face's units a dot fades over, past the core and before `far`
const tabs   = clock.states.map(({ name }) => ({ label: name }))

/**
 * Brings a state to the face by a journey along the hand, an ink dot leaving
 * the core past the request and off the face and a sea dot bringing the
 * forecast back into the core, whose words change as it lands, or for the
 * hour that fails, the dot stopping at the rim and nothing coming back.
 */
class Journey {
  readonly announcer = new Announcer()
  readonly core      = shallowRef<HTMLElement>()
  readonly id        = useId()
  readonly on        = shallowRef<ClockKey | 'away'>(clock.states[0]!.key)
  readonly root      = shallowRef<HTMLElement>()
  readonly selected  = shallowRef(0)
  readonly shown     = shallowRef(0)
  readonly #back     = shallowRef<SVGCircleElement>()
  readonly #frames   : FrameClock
  readonly #out      = shallowRef<SVGCircleElement>()
  #goal              : number | undefined
  #landed            = false
  #start             : number | undefined

  constructor() {
    this.#frames = new FrameClock(this.root, (now) => this.#step(now))
  }

  renderFace(): VNode {
    const [x, y] = clock.request

    return h('svg', { 'aria-hidden': true, viewBox: `0 0 ${clock.side} ${clock.side}` }, [
      h('circle', { class: 'request-clock-hair', cx: CENTER, cy: CENTER, r: RADII.rim }),
      ...clock.minutes.map((d) => h('path', { class: 'request-clock-minute', d })),
      ...clock.ticks.map((d) => h('path', { class: 'request-clock-tick', d })),
      h('path', { class: 'request-clock-hand', d: clock.hand }),
      ...clock.retries.map((d, index) =>
        h('path', { class: 'request-clock-retry request-clock-later', d, style: { '--i': index } })
      ),
      h('circle', { class: 'request-clock-dot', cx: x, cy: y, r: 6 }),
      h('path', { class: 'request-clock-cross', d: clock.cross }),
      h('circle', { class: 'request-clock-packet', opacity: 0, r: 4.5, ref: this.#out }),
      h('circle', { class: 'request-clock-packet request-clock-reply', opacity: 0, r: 4.5, ref: this.#back })
    ])
  }

  select(index: number): void {
    this.selected.value = index
    this.announcer.say(clock.states[index]!.text)
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
    const rising = clamp((radius - RADII.core) / FADES.in, 0, 1)
    const shown  = rising * clamp((RADII.far - radius) / FADES.out, 0, 1)

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
    const out   = fails ? leg * (RADII.rim - RADII.core) / (RADII.far - RADII.core) : leg
    const due   = fails ? out : 2 * leg + hover
    const reach = fails ? RADII.rim : RADII.far
    const core  = this.core.value!

    this.#place(this.#out.value!, RADII.core + (reach - RADII.core) * smoothstep(at / out), at < out)

    const back = RADII.far - (RADII.far - RADII.core) * smoothstep((at - due + leg) / leg)

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

      return h('div', { class: 'widget request-clock', ref: journey.root }, [
        h(
          'div',
          {
            'aria-label' : clock.label,
            class        : 'request-clock-face',
            'data-on'    : journey.on.value,
            role         : 'img'
          },
          [
            journey.renderFace(),
            h('div', { 'aria-hidden': true, class: 'request-clock-words' }, [
              ...clock.quarters.map((word) => hourWord(word, { quiet: word.quiet })),
              ...clock.said.map((word, index) => hourWord(word, { later: true, said: true }, index))
            ]),
            h('div', { 'aria-hidden': true, class: 'request-clock-core', ref: journey.core }, [
              h('b', { class: { 'request-clock-figures': state.figures } }, state.big),
              h('span', state.small)
            ]),
            h('span', {
              'aria-hidden' : true,
              class         : 'request-clock-send',
              onClick       : () => journey.send(),
              style         : at(clock.request)
            })
          ]
        ),
        h(
          Tablist,
          {
            id       : journey.id,
            label    : 'What the clock face shows',
            name     : 'request-clock',
            onSelect : (index: number) => journey.select(index),
            selected : journey.selected.value,
            tabs     : tabs
          },
          { default: ({ index }: { index: number }) => clock.states[index]!.name }
        ),
        h(
          'div',
          { ...tabPanel(journey.id, journey.selected.value), class: 'request-clock-panel' },
          layers(clock.states.map(({ text }) => h('p', text)), journey.selected.value)
        ),
        journey.announcer.region
      ])
    }
  }
})

function at([x, y]: readonly [x: number, y: number]): Record<string, string> {
  return { left: `${tenth(x / clock.side * 100)}%`, top: `${tenth(y / clock.side * 100)}%` }
}

function hourWord(
  { left, top, word } : ClockWord,
  classes             : Record<string, boolean>,
  index?              : number
): VNode {
  const style = { left: `${left}%`, top: `${top}%`, ...index === undefined ? {} : { '--i': index } }

  return h('span', { class: ['request-clock-hour', classes], style }, word)
}
