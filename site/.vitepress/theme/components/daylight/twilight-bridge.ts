import { bisectCenter } from 'd3-array'
import { type VNode, defineComponent, h, onMounted, shallowRef } from 'vue'

import { data }                    from '../../../lib/daylight/twilight-bridge.data.ts'
import { Glide }                   from '../../../lib/motion/glide.ts'
import { Announcer }               from '../../controls/announcer.ts'
import { PlotSlider, shareAcross } from '../../controls/plot-slider.ts'
import { bridgeDrawing, dropAt }   from './bridge-drawing.ts'

import './styles/twilight-bridge.css'

const { cut, decades, degrees, figures, height, high, label, low, phrases, rest, ticks, width, x, y } = data

const drops = x.map((_, stop) => dropAt(data, stop))
const lefts = x.map(percentOf)
const tops  = y.map(pixels)

/**
 * Holds the sun's stop, writing each mark and figure directly through strings
 * built ahead of any motion, so a glide allocates nothing as it moves.
 */
class BridgeWatch {
  readonly announcer = new Announcer()
  readonly root      = shallowRef<HTMLElement>()
  readonly slider    : PlotSlider
  #at                = rest
  #degree            : HTMLElement | undefined
  #drop              : SVGPathElement | undefined
  #figure            : HTMLElement | undefined
  readonly #glide    : Glide
  #handle            : HTMLElement | undefined
  #phrase            : HTMLElement | undefined
  #plot              : HTMLElement | undefined
  #sun               : HTMLElement | undefined

  constructor() {
    this.#glide = new Glide(rest, this.root, () => this.#settle(), (value) => this.#write(Math.round(value)))
    this.slider = new PlotSlider({
      count    : x.length,
      page     : 10,
      position : (clientX) => this.#stopAt(clientX),
      set      : (value, eased) => this.#glide.move(value, eased),
      value    : () => this.#glide.goal
    })

    onMounted(() => this.#mount())
  }

  #mount(): void {
    const root  = this.root.value!
    const named = <T extends Element>(name: string) => root.querySelector<T>(`.twilight-bridge-${name}`)!

    this.#degree = named('degree')
    this.#drop   = named('drop')
    this.#figure = named('figure')
    this.#handle = root.querySelector('.widget-slider')!
    this.#phrase = named('phrase')
    this.#plot   = named('plot')
    this.#sun    = named('sun')
  }

  #settle(): void {
    const words = spoken(this.#at)

    this.#handle!.setAttribute('aria-valuenow', String(this.#at))
    this.#handle!.setAttribute('aria-valuetext', words)
    this.announcer.say(words)
  }

  #stopAt(clientX: number): number {
    return bisectCenter(x, shareAcross(this.#plot!, clientX) * width)
  }

  #write(stop: number): void {
    if (stop === this.#at) return

    this.#at = stop
    this.#drop!.setAttribute('d', drops[stop]!)
    this.#sun!.style.left     = lefts[stop]!
    this.#sun!.style.top      = tops[stop]!
    this.#degree!.textContent = degrees[stop]!
    this.#figure!.textContent = figures[stop]!
    this.#phrase!.textContent = phraseAt(stop)
  }
}

/**
 * Draws the clear-sky curve from the end of civil twilight to a low sun on a
 * logarithmic lux scale, with the span up to the refraction cutoff washed and a
 * slider that moves the sun along the curve.
 */
export const TwilightBridge = defineComponent({
  name: 'TwilightBridge',
  setup() {
    const watch = new BridgeWatch()

    return () => h(
      'div',
      { 'aria-label': label, class: 'widget twilight-bridge', ref: watch.root, role: 'group' },
      [
        h('div', { class: 'twilight-bridge-plot', style: { height: pixels(height) } }, [
          bridgeDrawing(data),
          ...[{ at: 0, word: 'lux' }, ...decades].map(({ at, word }) => h(
            'span',
            { class: 'twilight-bridge-word twilight-bridge-level', style: { top: pixels(at) } },
            word
          )),
          ...ticks.map(({ at, minor, word }) => h(
            'span',
            {
              class : ['twilight-bridge-word twilight-bridge-along', { 'twilight-bridge-minor': minor }],
              style : { left: percentOf(at) }
            },
            word
          )),
          h('span', { class: 'widget-caps twilight-bridge-caps' }, [
            h('span', { class: 'twilight-bridge-the' }, 'The '),
            'bridge'
          ]),
          node(low.x, low.y),
          node(high.x, high.y),
          h(
            'span',
            { class: 'twilight-bridge-end twilight-bridge-low', style: { top: pixels(low.y) } },
            low.word
          ),
          h(
            'span',
            {
              class : 'twilight-bridge-end twilight-bridge-high',
              style : { left: percentOf(high.x), top: pixels(high.y) }
            },
            high.word
          ),
          h('span', { class: 'twilight-bridge-sun', style: { left: lefts[rest], top: tops[rest] } }),
          h('div', {
            class: 'widget-slider',
            ...watch.slider.attributes('The sun’s altitude', rest, spoken(rest))
          })
        ]),
        h('div', { class: 'twilight-bridge-readout' }, [
          h('b', { class: 'twilight-bridge-degree widget-num' }, degrees[rest]),
          h('b', { class: 'twilight-bridge-figure widget-num' }, figures[rest]),
          h('span', { class: 'twilight-bridge-phrase' }, phraseAt(rest))
        ]),
        watch.announcer.region
      ]
    )
  }
})

function node(left: number, top: number): VNode {
  return h('span', { class: 'twilight-bridge-node', style: { left: percentOf(left), top: pixels(top) } })
}

function percentOf(value: number): string {
  return `${value / width * 100}%`
}

function phraseAt(stop: number): string {
  return phrases[Math.sign(stop - cut) + 1]!
}

function pixels(value: number): string {
  return `${value}px`
}

function spoken(stop: number): string {
  return `${degrees[stop]}, ${figures[stop]}. ${phraseAt(stop)}.`
}
