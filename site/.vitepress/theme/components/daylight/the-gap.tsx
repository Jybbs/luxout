import { type PropType, type ShallowRef, type VNode, defineComponent, onMounted, shallowRef } from 'vue'

import { data }                    from '../../../lib/daylight/daylight.data.ts'
import type * as gap               from '../../../lib/daylight/gap.ts'
import { Glide }                   from '../../../lib/motion/glide.ts'
import { Announcer }               from '../../controls/announcer.tsx'
import { PlotSlider, shareAcross } from '../../controls/plot-slider.ts'
import { gapDrawing }              from './gap-drawing.tsx'

/**
 * The utilities the widget draws each mark of its drawings and of its swatches
 * in, by the class the mark carries, the cursor's guide and dot showing only
 * while a reader points.
 */
const MARKS = [
  '[&_.the-gap-band]:fill-gap-band [&_.the-gap-edge]:stroke-ink [&_.the-gap-edge]:stroke-[1.2]',
  '[&_:is(.the-gap-tie,.the-gap-guide)]:[stroke-dasharray:2_3] [&_:is(.the-gap-tie,.the-gap-guide)]:stroke-1',
  '[&_.the-gap-tie]:stroke-muted [&_.the-gap-guide]:stroke-ink',
  '[&_:is(.the-gap-halo,.the-gap-reading)]:fill-none',
  '[&_:is(.the-gap-halo,.the-gap-reading)]:[stroke-linecap:round]',
  '[&_:is(.the-gap-halo,.the-gap-reading)]:[stroke-linejoin:round]',
  '[&_.the-gap-halo]:stroke-ground [&_.the-gap-halo]:stroke-6',
  '[&_.the-gap-reading]:stroke-estimate [&_.the-gap-reading]:stroke-2',
  '[&_.the-gap-on]:fill-gap-on [&_.the-gap-on]:stroke-ink [&_.the-gap-on]:stroke-[1.2]',
  '[&_.the-gap-off]:stroke-muted [&_.the-gap-off]:stroke-[1.2]',
  '[&_.the-gap-ring]:fill-ground [&_.the-gap-ring]:stroke-ink [&_.the-gap-ring]:stroke-[1.5]',
  '[&_.the-gap-chip]:fill-sunken [&_.the-gap-chip]:stroke-rule [&_.the-gap-chip]:stroke-1',
  '[&_:is(.the-gap-word,.the-gap-figure)]:text-[11px] [&_.the-gap-word]:fill-muted',
  '[&_.the-gap-figure]:fill-ink',
  '[&_.the-gap-chip-name]:fill-ink [&_.the-gap-chip-name]:text-[10px] [&_.the-gap-chip-name]:font-semibold',
  '[&_.the-gap-chip-name]:tracking-[0.08em] [&_.the-gap-chip-name]:uppercase',
  '[&_.the-gap-count]:fill-ink [&_.the-gap-count]:font-semibold',
  '[&_:is(.the-gap-dot,.the-gap-thumb)]:fill-estimate [&_:is(.the-gap-dot,.the-gap-thumb)]:stroke-ground',
  '[&_.the-gap-dot]:stroke-[1.5] [&_.the-gap-thumb]:stroke-2',
  '[&_:is(.the-gap-guide,.the-gap-dot)]:invisible data-pointing:[&_:is(.the-gap-guide,.the-gap-dot)]:visible'
]
/**
 * The utilities the plot takes, showing the one drawing whose layout fits the
 * width of the widget.
 */
const PLOT = [
  'relative [&>svg]:hidden [&>svg]:h-auto [&>svg]:w-full [&>svg]:overflow-visible',
  '[&>svg]:widget-num [&>svg:nth-of-type(1)]:block @sm:[&>svg:nth-of-type(1)]:hidden',
  '@sm:[&>svg:nth-of-type(2)]:block @md:[&>svg:nth-of-type(2)]:hidden @md:[&>svg:nth-of-type(3)]:block'
]
/**
 * The utilities the table beneath the drawing takes, by the cells and rows of
 * each of its parts.
 */
const TABLE = [
  'm-0 table w-full table-fixed border-collapse text-[0.88rem]/[1.5] text-inherit',
  '[&_caption]:min-h-[calc(1lh+8px)] [&_caption]:caption-top [&_caption]:pb-2 [&_caption]:text-left',
  '[&_:is(th,td,tr)]:border-0 [&_:is(th,td,tr)]:bg-transparent [&_:is(th,td,tr)]:py-1.75',
  '[&_:is(th,td,tr)]:pr-3 [&_:is(th,td,tr)]:pl-0 [&_:is(th,td,tr)]:text-left',
  '[&_:is(th,td,tr)]:align-baseline',
  '[&_:is(th,td,tr)]:text-[length:inherit] [&_thead_tr]:border-b-[1.5px] [&_thead_tr]:border-ink',
  '[&_thead_th]:pt-0 [&_thead_th]:font-semibold [&_thead_th]:text-ink',
  '[&_tbody_tr]:border-b [&_tbody_tr]:border-rule [&_tbody_th]:font-normal [&_tbody_th]:text-muted',
  '[&_tbody_td]:text-ink [&_td[colspan]]:text-muted'
]
const SWATCHES = {
  off  : () => <path class="the-gap-off" d="M1 10H13" />,
  on   : () => <rect class="the-gap-on" height={8} width={12} x={1} y={2} />,
  ring : () => <circle class="the-gap-ring" cx={7} cy={6} r={4} />
} satisfies Record<gap.GapCell['mark'], () => VNode>
const THUMB = { height: 22, width: 8 }

/**
 * Writes one drawing's cursor at each minute through strings built when the
 * drawing mounts, so a glide allocates nothing as it moves.
 */
class GapPlot {
  readonly #cursor : SVGGElement
  readonly #layout : gap.GapLayout
  readonly #mark   : SVGGElement
  readonly #moves  : readonly string[]
  readonly #rises  : readonly string[]
  readonly #svg    : SVGSVGElement

  constructor(layout: gap.GapLayout, svg: SVGSVGElement) {
    this.#cursor = svg.querySelector('.the-gap-cursor')!
    this.#layout = layout
    this.#mark   = svg.querySelector('.the-gap-mark')!
    this.#moves  = layout.x.map((x) => `translate(${x} 0)`)
    this.#rises  = layout.y.map((y) => `translate(0 ${y})`)
    this.#svg    = svg
  }

  get shown(): boolean {
    return this.#svg.getBoundingClientRect().width > 0
  }

  /**
   * Finds the minute under a pointer at `clientX`, clamped to the span drawn.
   */
  minuteAt(clientX: number): number {
    return Math.round(shareAcross(this.#svg, clientX, this.#layout) * (this.#moves.length - 1))
  }

  place(minute: number): void {
    this.#cursor.setAttribute('transform', this.#moves[minute]!)
    this.#mark.setAttribute('transform', this.#rises[minute]!)
  }
}

/**
 * Holds the minute a reader points to, moving each drawing's cursor directly
 * and passing the table a new minute once a motion ends.
 */
class Pointer {
  readonly announcer = new Announcer()
  readonly minute    = shallowRef<gap.GapMinute>()
  readonly root      = shallowRef<HTMLElement>()
  readonly slider    : PlotSlider
  #at                = data.gap.rest
  readonly #glide    : Glide
  #handle            : HTMLElement | undefined
  readonly #nows     = data.gap.minutes.map((_, index) => String(index))
  #plots             : readonly GapPlot[] = []

  constructor() {
    this.#glide = new Glide(
      data.gap.rest,
      this.root,
      () => this.#settle(),
      (value) => this.#write(Math.round(value))
    )
    this.slider = new PlotSlider({
      count    : data.gap.minutes.length,
      page     : 15,
      position : (clientX) => this.#plots.find((plot) => plot.shown)!.minuteAt(clientX),
      rest     : () => this.#rest(),
      value    : () => this.#glide.goal,
      set      : (value, eased) => {
        this.root.value!.toggleAttribute('data-pointing', true)
        this.#glide.move(value, eased)
      }
    })

    onMounted(() => this.#mount())
  }

  #mount(): void {
    const root = this.root.value!

    this.#plots = Array.from(root.querySelectorAll<SVGSVGElement>('.the-gap-drawing'), (svg, index) =>
      new GapPlot(data.gap.layouts[index]!, svg)
    )
    this.#handle = root.querySelector('.widget-slider')!
  }

  #rest(): void {
    this.root.value?.toggleAttribute('data-pointing', false)
    this.#glide.snap(data.gap.rest)
    this.minute.value = undefined
    this.announcer.say('')
  }

  #settle(): void {
    const minute = data.gap.minutes[this.#at]!

    this.minute.value = minute
    this.announcer.say(minute.spoken)
  }

  #write(minute: number): void {
    if (minute === this.#at) return

    this.#at = minute

    for (const plot of this.#plots) plot.place(minute)

    this.#handle!.setAttribute('aria-valuenow', this.#nows[minute]!)
    this.#handle!.setAttribute('aria-valuetext', data.gap.minutes[minute]!.reading)
  }
}

/**
 * Sets the two sensors side by side beneath the lanes, so the off level, the
 * one cell where they differ, sits above what each sensor does at the minute a
 * reader points to and how many switches it has made by then.
 */
const GapTable = defineComponent({
  name  : 'GapTable',
  props : { minute: { required: true, type: Object as PropType<ShallowRef<gap.GapMinute | undefined>> } },
  setup(props) {
    return () => {
      const at = props.minute.value

      return (
        <table class={TABLE}>
          <caption>
            {...(at
              ? [numeral('span', `${at.clock} · ${at.lux} lux`)]
              : ['From ', numeral('span', data.gap.span[0]), ' to ', numeral('span', data.gap.span[1])])}
          </caption>
          <colgroup>
            <col class="w-22 @md:w-26" />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <td />
              {data.gap.sensors.map(({ name }) => <th scope="col">{name}</th>)}
            </tr>
          </thead>
          <tbody>
            {row('On at', data.gap.sensors.map(({ onAt }) => numeral('td', onAt)))}
            {row('Off below', data.gap.sensors.map(({ offBelow }) => numeral('td', offBelow)))}
            {row('Now', at
              ? at.cells.map(({ mark, word }) => <td>{swatch(mark)}{word}</td>)
              : <td colspan={2}>Point along the morning</td>)}
            {row('Switches', at
              ? at.cells.map(({ count }) => numeral('td', count))
              : data.gap.sensors.map(({ switches }) => numeral('td', switches)))}
          </tbody>
        </table>
      )
    }
  }
})

/**
 * Draws the gap on a sample day whose reading crosses one level back and forth
 * as the clouds move, with a slider over the drawing and the table beneath it.
 */
export const TheGap = defineComponent({
  name: 'TheGap',
  setup() {
    const pointer = new Pointer()

    return () => (
      <div class={['widget the-gap grid gap-4', ...MARKS]} ref={pointer.root}>
        <div class={PLOT}>
          {data.gap.layouts.map((layout) => gapDrawing(layout, data.gap, cursor(layout)))}
          <div
            class="widget-slider"
            {...pointer.slider.attributes(
              'Minute of the late morning',
              data.gap.rest,
              data.gap.minutes[data.gap.rest]!.reading
            )}
          />
        </div>
        <div class="grid gap-3 border-t border-rule pt-3.5">
          <p class="widget-note">
            {swatch('ring')}
            Each ring is a switch, which can run an automation in the Home app built on the state the sensor
            switched to.
          </p>
          <GapTable minute={pointer.minute} />
        </div>
        {pointer.announcer.region}
      </div>
    )
  }
})

function cursor({ guide, x, y }: gap.GapLayout): VNode {
  return (
    <g class="the-gap-cursor" transform={`translate(${x[data.gap.rest]} 0)`}>
      <path class="the-gap-guide" d={guide} />
      <g class="the-gap-mark" transform={`translate(0 ${y[data.gap.rest]})`}>
        <circle class="the-gap-dot" r={3.5} />
        <rect
          class="the-gap-thumb"
          height={THUMB.height}
          rx={THUMB.width / 2}
          width={THUMB.width}
          x={-THUMB.width / 2}
          y={-THUMB.height / 2}
        />
      </g>
    </g>
  )
}

function numeral(tag: 'span' | 'td', text: number | string): VNode {
  return tag === 'td' ? <td class="widget-num">{text}</td> : <span class="widget-num">{text}</span>
}

function row(name: string, cells: VNode | VNode[]): VNode {
  return (
    <tr>
      <th scope="row">{name}</th>
      {cells}
    </tr>
  )
}

function swatch(mark: gap.GapCell['mark']): VNode {
  return (
    <svg aria-hidden class="the-gap-swatch mr-2 inline-block h-3 w-3.5 align-[-0.05em]" viewBox="0 0 14 12">
      {SWATCHES[mark]()}
    </svg>
  )
}
