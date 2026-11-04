import { clamp } from '@vueuse/core'
import { type PropType, type ShallowRef, type VNode, defineComponent, h, onMounted, shallowRef } from 'vue'

import { data }       from '../../../lib/daylight/daylight.data.ts'
import type * as gap  from '../../../lib/daylight/gap.ts'
import { Glide }      from '../../../lib/motion/glide.ts'
import { Announcer }  from '../../controls/announcer.ts'
import { PlotSlider } from '../../controls/plot-slider.ts'
import { gapDrawing } from './gap-drawing.ts'

import './styles/the-gap.css'

const SWATCHES = {
  off  : () => h('path', { class: 'the-gap-off', d: 'M1 10H13' }),
  on   : () => h('rect', { class: 'the-gap-on', height: 8, width: 12, x: 1, y: 2 }),
  ring : () => h('circle', { class: 'the-gap-ring', cx: 7, cy: 6, r: 4 })
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
    const { left, right, width }        = this.#layout
    const { left: start, width: drawn } = this.#svg.getBoundingClientRect()
    const along                         = ((clientX - start) * width / drawn - left) / (right - left)

    return Math.round(clamp(along, 0, 1) * (this.#moves.length - 1))
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

        if (eased) this.#glide.ease(value)
        else this.#glide.snap(value)
      }
    })

    onMounted(() => this.#mount())
  }

  #mount(): void {
    const root = this.root.value!

    this.#plots = Array.from(root.querySelectorAll<SVGSVGElement>('.the-gap-drawing'), (svg, index) =>
      new GapPlot(data.gap.layouts[index]!, svg)
    )
    this.#handle = root.querySelector<HTMLElement>('[role=slider]')!
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

      return h('table', { class: 'the-gap-table' }, [
        h('caption', at
          ? numeral('span', `${at.clock} · ${at.lux} lux`)
          : ['From ', numeral('span', data.gap.span[0]), ' to ', numeral('span', data.gap.span[1])]),
        h('colgroup', [h('col', { class: 'the-gap-names' }), h('col'), h('col')]),
        h('thead', h('tr', [h('td'), data.gap.sensors.map(({ name }) => h('th', { scope: 'col' }, name))])),
        h('tbody', [
          row('On at', data.gap.sensors.map(({ onAt }) => numeral('td', onAt))),
          row('Off below', data.gap.sensors.map(({ offBelow }) => numeral('td', offBelow))),
          row('Now', at
            ? at.cells.map(({ mark, word }) => h('td', [swatch(mark), word]))
            : h('td', { class: 'the-gap-ask', colspan: 2 }, 'Point along the morning')),
          row('Switches', at
            ? at.cells.map(({ count }) => numeral('td', count))
            : data.gap.sensors.map(({ switches }) => numeral('td', switches)))
        ])
      ])
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
    const pointer    = new Pointer()
    const { slider } = pointer

    return () => h('div', { class: 'widget the-gap', ref: pointer.root }, [
      h('div', { class: 'the-gap-plot' }, [
        data.gap.layouts.map((layout) => gapDrawing(layout, data.gap, cursor(layout))),
        h('div', {
          'aria-label'     : 'Minute of the late morning',
          'aria-valuemax'  : data.gap.minutes.length - 1,
          'aria-valuemin'  : 0,
          'aria-valuenow'  : data.gap.rest,
          'aria-valuetext' : data.gap.minutes[data.gap.rest]!.reading,
          class            : 'the-gap-slider',
          onBlur           : slider.onBlur,
          onKeydown        : slider.onKeydown,
          onPointercancel  : slider.onPointerup,
          onPointerdown    : slider.onPointerdown,
          onPointerleave   : slider.onPointerleave,
          onPointermove    : slider.onPointermove,
          onPointerup      : slider.onPointerup,
          role             : 'slider',
          tabindex         : 0
        })
      ]),
      h('div', { class: 'the-gap-below' }, [
        h('p', { class: 'widget-note' }, [
          swatch('ring'),
          'Each ring is a switch, which runs the automations built on that sensor in the Home app.'
        ]),
        h(GapTable, { minute: pointer.minute })
      ]),
      pointer.announcer.region
    ])
  }
})

function cursor({ guide, x, y }: gap.GapLayout): VNode {
  return h('g', { class: 'the-gap-cursor', transform: `translate(${x[data.gap.rest]} 0)` }, [
    h('path', { class: 'the-gap-guide', d: guide }),
    h('g', { class: 'the-gap-mark', transform: `translate(0 ${y[data.gap.rest]})` }, [
      h('circle', { class: 'the-gap-dot', r: 3.5 }),
      h('rect', {
        class  : 'the-gap-thumb',
        height : THUMB.height,
        rx     : THUMB.width / 2,
        width  : THUMB.width,
        x      : -THUMB.width / 2,
        y      : -THUMB.height / 2
      })
    ])
  ])
}

function numeral(tag: 'span' | 'td', text: number | string): VNode {
  return h(tag, { class: 'widget-num' }, text)
}

function row(name: string, cells: VNode | VNode[]): VNode {
  return h('tr', [h('th', { scope: 'row' }, name), cells])
}

function swatch(mark: gap.GapCell['mark']): VNode {
  return h('svg', { 'aria-hidden': true, class: 'the-gap-swatch', viewBox: '0 0 14 12' }, SWATCHES[mark]())
}
