import { clamp, useEventListener, useResizeObserver }    from '@vueuse/core'
import { useData }                                       from 'vitepress'
import { defineComponent, onMounted, shallowRef, watch } from 'vue'

import { data }                from '../../../lib/front/front.data.ts'
import { positionOf, valueAt } from '../../../lib/front/facts.ts'
import { useFrontMinute }      from '../../../lib/front/minute.ts'
import { useMotion }           from '../../../lib/motion/motion.ts'
import { smoothstep }          from '../../../lib/motion/timing.ts'
import { HeroReading }         from './hero-reading.tsx'

/**
 * How far the scroll carries the light and its color, each as a share of the
 * hero's height, beside the flare the page's rising edge takes around sunset.
 */
const CARRY = { clear: 0.6, edge: { at: 0.7, width: 0.18 }, tint: 0.12, travel: 2 }
const INKS  = { dark: 'var(--luxout-dark)', light: 'var(--luxout-ground)' }

const { day, hero } = data
const { logs }      = hero
const peak          = day.altitudes[day.noon]!
const schemes       = Object.entries(hero.schemes)
const steps         = hero.schemes.dark.skies.length - 1

/**
 * Holds the hero's minute, writing the sky's color, the sun's place, and the
 * share of each piece over the sky that the page's rising edge leaves shown
 * straight to the page as the scroll moves, so a scroll renders nothing.
 */
class HeroScene {
  readonly root    = shallowRef<HTMLElement>()
  #band            : Element | undefined
  #fade            = 1
  #height          = 1
  #hero            : HTMLElement | undefined
  #home            : HTMLElement | undefined
  readonly #minute = useFrontMinute()
  readonly #paused = useMotion().paused
  #pieces          : HTMLElement[] = []
  #scrolled        = day.noon

  constructor() {
    onMounted(() => this.#mount())
  }

  /**
   * Covers each piece over the sky by the share the page's rising edge has
   * passed, eased along smoothstep, so a piece the edge has just reached stays
   * whole and the sliver still above it near its top has all but gone.
   */
  #cover(): void {
    const edge = this.#band!.getBoundingClientRect().top

    for (const piece of this.#pieces) {
      const { bottom, top } = piece.getBoundingClientRect()

      piece.style.setProperty('--front-shown', smoothstep((edge - top) / (bottom - top)).toFixed(3))
    }
  }

  /**
   * Draws the hero at `minute`, the sky in the color of its light and the
   * bands below tinted by it, the tint easing to a quarter while the page's
   * rising edge flares around sunset.
   */
  #draw(minute: number): void {
    const place = positionOf(day, valueAt(day.readings, minute))
    const step  = Math.round(place * steps)
    const edge  = 1 - smoothstep(Math.abs(place - CARRY.edge.at) / CARRY.edge.width)
    const home  = this.#home!.style
    const word  = this.root.value!.style
    const up    = valueAt(day.altitudes, minute)

    for (const [scheme, { dark, skies, tints }] of schemes) {
      home.setProperty(`--front-above-${scheme}`, dark[step] ? INKS.dark : INKS.light)
      home.setProperty(`--front-edge-${scheme}`, dark[step] ? INKS.dark : 'none')
      home.setProperty(`--front-point-${scheme}`, tints[step]!)
      home.setProperty(`--front-sky-${scheme}`, skies[step]!)
    }

    home.setProperty('--front-a', (edge * this.#fade).toFixed(3))
    home.setProperty('--front-share', (CARRY.tint * (1 - 0.75 * edge) * this.#fade).toFixed(4))
    word.setProperty('--front-fade', this.#fade.toFixed(3))
    word.setProperty('--front-up', up >= 0 ? '1' : '0')
    word.setProperty('--front-x', ((minute - day.noon + hero.reach) / (2 * hero.reach)).toFixed(4))
    word.setProperty('--front-y', Math.max(0, 1 - up / peak).toFixed(4))
  }

  /**
   * Finds the minute after noon at which the clear sky's light falls to `log`,
   * between the two whole minutes around it.
   */
  #minuteAt(log: number): number {
    const after = logs.findIndex((value) => value <= log)

    if (after <= 0) return after ? day.noon + logs.length - 1 : day.noon

    return day.noon + after - 1 + (logs[after - 1]! - log) / (logs[after - 1]! - logs[after]!)
  }

  #mount(): void {
    this.#hero   = this.root.value!.closest<HTMLElement>('.VPHero')!
    this.#home   = this.#hero.closest<HTMLElement>('.VPHome')!
    this.#band   = this.#hero.nextElementSibling!
    this.#pieces = [
      ...this.#hero.querySelectorAll<HTMLElement>('.front-title, .tagline, .actions, .front-reading')
    ]

    useResizeObserver(this.#hero, ([entry]) => {
      this.#height = entry!.contentRect.height
      this.#scroll()
    })
    useEventListener('scroll', () => this.#scroll(), { passive: true })
    watch(this.#minute, (minute) => this.#draw(minute))
    watch(this.#paused, () => this.#scroll())
    this.#scroll()

    if (this.#paused.value) this.#draw(this.#minute.value)
  }

  /**
   * Runs the light from noon to HomeKit's floor at one pace along its
   * logarithm over `CARRY.travel` hero heights of scroll, writing the shared
   * minute each time the scroll moves it, and holds the minute and the glow
   * where they stand while the site's drawings are paused.
   */
  #scroll(): void {
    this.#cover()

    if (this.#paused.value) return

    const travel = this.#height * CARRY.travel
    const at     = this.#minuteAt(logs[0]! + (logs.at(-1)! - logs[0]!) * clamp(scrollY / travel, 0, 1))

    this.#fade = 1 - clamp((scrollY - travel) / (this.#height * CARRY.clear), 0, 1)

    if (at === this.#scrolled) return this.#draw(this.#minute.value)

    this.#scrolled     = at
    this.#minute.value = at
  }
}

/**
 * Draws the front page's hero: the logo's title centered on its horizon under
 * the sun's path, the sky above the line in the color of the minute's light,
 * and the tagline beneath, with the reading at the minute in the sky's corner.
 */
export const FrontHero = defineComponent({
  name: 'FrontHero',
  setup() {
    const scene           = new HeroScene()
    const { frontmatter } = useData()
    const shares          = hero.shares
    const step            = Math.round(positionOf(day, day.readings[day.noon]!) * steps)
    const noon            = Object.fromEntries(schemes.flatMap(([scheme, { dark, skies }]) => [
      [`--front-noon-above-${scheme}`, dark[step] ? INKS.dark : INKS.light],
      [`--front-noon-edge-${scheme}`, dark[step] ? INKS.dark : 'none'],
      [`--front-noon-sky-${scheme}`, skies[step]]
    ]))

    return () => (
      <div class="contents">
        <div
          class="front-word"
          ref={scene.root}
          style={{
            ...noon,
            '--front-height'  : shares.height,
            '--front-horizon' : shares.horizon,
            '--front-ink'     : shares.right - shares.left,
            '--front-left'    : shares.left,
            '--front-line'    : shares.line,
            '--front-sun'     : shares.sun
          }}
        >
          <div aria-hidden class="front-sky" />
          <div aria-hidden class="front-line front-line-left" />
          <div aria-hidden class="front-line front-line-right" />
          <div aria-hidden class="front-arc">
            <svg preserveAspectRatio="none" viewBox={`0 0 ${2 * hero.reach} 1000`}>
              {...hero.arcs.map((d, index) => <path class={`front-dots front-dots-${index}`} d={d} />)}
            </svg>
            <span class="front-glow" />
            <span class="front-sun" />
          </div>
          <h1 class="front-title">
            <span class="sr-only">{frontmatter.value.hero.name}</span>
            <span aria-hidden class="front-title-art dark:hidden" innerHTML={hero.schemes.light.title} />
            <span aria-hidden class="front-title-art hidden dark:block" innerHTML={hero.schemes.dark.title} />
          </h1>
        </div>
        <p class="tagline">{frontmatter.value.hero.tagline}</p>
        <HeroReading />
      </div>
    )
  }
})
