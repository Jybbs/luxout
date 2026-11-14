import { type VNode, defineComponent, onMounted, shallowRef } from 'vue'

import { data }                  from '../../../lib/daylight/twilight-bridge.data.ts'
import { Glide }                 from '../../../lib/motion/glide.ts'
import { Speech }                from '../../../lib/motion/speech.ts'
import { OVERLAY, PlotSlider }   from '../../controls/plot-slider.tsx'
import { bridgeDrawing, dropAt } from './bridge-drawing.tsx'

const END    = 'font-semibold text-ink'
const FIGURE = 'widget-num text-right text-[0.9rem] font-semibold whitespace-nowrap'
/**
 * The utilities the plot draws each mark of the bridge in, by the class the
 * mark carries.
 */
const MARKS = [
  'twilight-bridge-plot relative mt-5 mr-4 mb-7 ml-16',
  '[&>svg]:absolute [&>svg]:inset-0 [&>svg]:size-full [&>svg]:overflow-visible',
  '[&_path]:[vector-effect:non-scaling-stroke] [&_.twilight-bridge-wash]:fill-bridge-wash',
  '[&_.twilight-bridge-sky]:fill-sky-fill [&_.twilight-bridge-grid]:stroke-rule',
  '[&_.twilight-bridge-grid]:stroke-1 [&_.twilight-bridge-axis]:fill-none',
  '[&_.twilight-bridge-axis]:stroke-muted [&_.twilight-bridge-axis]:stroke-1',
  '[&_.twilight-bridge-roof]:stroke-bridge-line [&_.twilight-bridge-roof]:stroke-2',
  '[&_.twilight-bridge-cut]:stroke-bridge-line [&_.twilight-bridge-cut]:[stroke-dasharray:3_3]',
  '[&_.twilight-bridge-cut]:stroke-[1.25] [&_.twilight-bridge-edge]:fill-none',
  '[&_.twilight-bridge-edge]:stroke-ink [&_.twilight-bridge-edge]:[stroke-linejoin:round]',
  '[&_.twilight-bridge-edge]:stroke-[1.5]',
  '[&_.twilight-bridge-drop]:fill-none [&_.twilight-bridge-drop]:stroke-ink',
  '[&_.twilight-bridge-drop]:[stroke-dasharray:2_3] [&_.twilight-bridge-drop]:stroke-1',
  '@max-sm:[&_.twilight-bridge-minor]:hidden'
]
const WORD = 'absolute font-mono text-[0.7rem]/none tabular-nums whitespace-nowrap'

const { cut, decades, degrees, figures, height, high, label, low, phrases, rest, ticks, width, x, y } = data

const drops = x.map((_, stop) => dropAt(data, stop))
const lefts = x.map(percentOf)
const tops  = y.map(pixels)

/**
 * Holds the sun's stop, writing each mark and figure directly through strings
 * built ahead of any motion, so a glide allocates nothing as it moves.
 */
class BridgeWatch {
  readonly root   = shallowRef<HTMLElement>()
  readonly slider : PlotSlider
  readonly speech = new Speech(this.root)
  #at             = rest
  #degree         : HTMLElement | undefined
  #drop           : SVGPathElement | undefined
  #figure         : HTMLElement | undefined
  readonly #glide : Glide
  #phrase         : HTMLElement | undefined
  #sun            : HTMLElement | undefined

  constructor() {
    this.#glide = new Glide(rest, this.root, () => this.#settle(), (value) => this.#write(Math.round(value)))
    this.slider = new PlotSlider({
      count : x.length,
      label : 'The sun’s altitude',
      page  : 10,
      set   : (value, eased) => this.#glide.move(value, eased),
      text  : spoken,
      value : () => this.#glide.goal
    })

    onMounted(() => this.#mount())
  }

  #mount(): void {
    const root  = this.root.value!
    const named = <T extends Element>(name: string) => root.querySelector<T>(`.twilight-bridge-${name}`)!

    this.#degree = named('degree')
    this.#drop   = named('drop')
    this.#figure = named('figure')
    this.#phrase = named('phrase')
    this.#sun    = named('sun')
  }

  #settle(): void {
    this.speech.say(spoken(this.#at))
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

    return () => (
      <div aria-label={label} class="widget twilight-bridge grid gap-3" ref={watch.root} role="group">
        <div class={MARKS} style={{ height: pixels(height) }}>
          {bridgeDrawing(data)}
          {...[{ at: 0, word: 'lux' }, ...decades].map(({ at, word }) => (
            <span
              class={[WORD, 'right-[calc(100%+6px)] -translate-y-1/2 font-medium text-muted']}
              style={{ top: pixels(at) }}
            >
              {word}
            </span>
          ))}
          {...ticks.map(({ at, minor, word }) => (
            <span
              class={[
                WORD,
                'top-[calc(100%+10px)] -translate-x-1/2 font-medium text-muted',
                { 'twilight-bridge-minor': minor }
              ]}
              style={{ left: percentOf(at) }}
            >
              {word}
            </span>
          ))}
          <span
            class={[
              'twilight-bridge-caps absolute top-2 left-1.5 font-mono text-[0.7rem]/[1.45] font-medium',
              'tracking-widest text-ink uppercase'
            ]}
          >
            <span class="twilight-bridge-the @max-sm:hidden">{'The '}</span>
            bridge
          </span>
          {node(low.x, low.y)}
          {node(high.x, high.y)}
          <span
            class={[WORD, 'twilight-bridge-low right-[calc(100%+10px)] -translate-y-1/2', END]}
            style={{ top: pixels(low.y) }}
          >
            {low.word}
          </span>
          <span
            class={[
              WORD,
              'twilight-bridge-high translate-x-[calc(-100%-8px)] translate-y-[calc(-100%-6px)]',
              END
            ]}
            style={{ left: percentOf(high.x), top: pixels(high.y) }}
          >
            {high.word}
          </span>
          <span
            class={[
              'twilight-bridge-sun absolute size-3.5 -translate-1/2 rounded-full bg-sky',
              'ring-[1.5px] ring-ink'
            ]}
            style={{ left: lefts[rest], top: tops[rest] }}
          />
          {watch.slider.render(OVERLAY)}
        </div>
        <div
          class={[
            'grid grid-cols-[5ch_10ch_minmax(0,1fr)] items-baseline gap-x-3.5 gap-y-0.5 border-t border-rule',
            'pt-2.5'
          ]}
        >
          <b class={['twilight-bridge-degree', FIGURE]}>{degrees[rest]}</b>
          <b class={['twilight-bridge-figure', FIGURE]}>{figures[rest]}</b>
          <span
            class="twilight-bridge-phrase min-h-[2lh] text-[0.9rem]/[1.3] text-muted @max-sm:col-span-full"
          >
            {phraseAt(rest)}
          </span>
        </div>
      </div>
    )
  }
})

function node(left: number, top: number): VNode {
  return (
    <span
      class="twilight-bridge-node absolute size-1.5 -translate-1/2 rounded-full bg-ink"
      style={{ left: percentOf(left), top: pixels(top) }}
    />
  )
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
