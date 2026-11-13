import { useTimeoutFn } from '@vueuse/core'
import { range }        from 'd3-array'
import { type VNode, defineComponent, onMounted, shallowRef, useId } from 'vue'

import { DAY_MINUTES }              from '../../../lib/daylight/clock.ts'
import { data }                     from '../../../lib/daylight/day-dial.data.ts'
import * as dialLens                from '../../../lib/daylight/dial-lens.ts'
import { Glide }                    from '../../../lib/motion/glide.ts'
import { DURATIONS, PAUSES }        from '../../../lib/motion/timing.ts'
import { Announcer }                from '../../controls/announcer.tsx'
import { FocusRow }                 from '../../controls/focus-row.ts'
import { layers }                   from '../../controls/layers.tsx'
import { panelId, tabId, tabPanel } from '../../controls/tablist.tsx'
import { dialDrawing }              from './dial-drawing.tsx'

import './styles/day-estimate.css'

const { marks, opens, stretches } = data

const PEEK  = 1 / 3  // How far a twilight eases toward its quarter while a pointer rests on it
const REACH = {
  floor : 0.9,  // The share of the floor ring's radius a pointer stays past to count as on the dial
  rim   : 30,   // The drawing units past the rim a pointer stays within to count as on the dial
  track : 3     // The drawing units past the rim where the track outside the dial starts
}
const STILL     = 4  // The distance in pixels a pointer may drift and still count as resting
const plot      = new dialLens.DialPlot(marks)
const twilights = dialLens.HALVES.map((half) => plot.twilight(half))
const opened    = twilights.map((twilight) => twilight === opens ? 1 : 0)
const rest      = dialLens.HALVES.map((half) => plot.paths(half, opened[half]!))

/**
 * Holds the stretch a reader picks and the stretch a resting pointer or the
 * focus peeks at, moving each twilight's opening through paths built ahead of
 * the first motion, so a motion allocates nothing as it moves.
 */
class StretchPicker {
  readonly announcer = new Announcer()
  readonly id        = useId()
  readonly names     = new FocusRow('ArrowRight', 'ArrowLeft')
  readonly peek      = shallowRef(-1)
  readonly plot      = shallowRef<HTMLElement>()
  readonly root      = shallowRef<HTMLElement>()
  readonly selected  = shallowRef(opens)

  readonly onPointerdown = (event: PointerEvent): void => {
    if (this.#named(event) >= 0) return

    const index = this.#stretchAt(event)

    if (index >= 0) this.pick(index)
  }

  readonly onPointerleave = (event: PointerEvent): void => {
    this.#hover(-1, event)
  }

  readonly onPointermove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return

    const named = this.#named(event)
    const under = named >= 0 ? named : this.#stretchAt(event)

    this.plot.value!.style.cursor = under >= 0 && under !== this.selected.value ? 'pointer' : ''
    this.#hover(under, event)
  }

  readonly #away   = useTimeoutFn(() => this.#commit(-1), PAUSES.leave, { immediate: false })
  readonly #dwell  = useTimeoutFn((index: number) => this.#commit(index), PAUSES.dwell, { immediate: false })
  #elements        : readonly (readonly Element[])[] = []
  #from            = { x: 0, y: 0 }
  readonly #glides : readonly Glide[]
  #held            = -1
  #levels          : readonly (readonly (readonly string[])[])[] | undefined
  #next            = -1
  #over            = -1
  readonly #shown  : number[] = opened.map((open) => open * dialLens.OPENING_STEPS)

  constructor() {
    this.#glides = dialLens.HALVES.map((half) => new Glide(
      opened[half]!,
      this.root,
      () => undefined,
      (value) => this.#paint(half, value),
      DURATIONS.settle
    ))

    onMounted(() => this.#mount())
  }

  /**
   * Takes the stretch whose name the focus lands on as the one the peek
   * follows, or the pointer's once the focus leaves the names.
   */
  hold(index: number): void {
    this.#held = index
    this.#peekAt(index >= 0 ? index : this.#over)
  }

  pick(index: number): void {
    const { caption, figure, name } = stretches[index]!

    this.selected.value = index
    this.announcer.say(`${name}, ${figure} ${caption}`)
    this.#peekAt(this.#held >= 0 ? this.#held : this.#over)
  }

  #commit(index: number): void {
    this.#away.stop()
    this.#over = index
    this.#peekAt(index >= 0 ? index : this.#held)
  }

  /**
   * Peeks at the stretch under a pointer once it has rested for the dwell
   * pause, each move past a few pixels starting the wait again, and closes the
   * peek the leave pause after the pointer leaves the peeked stretch.
   */
  #hover(index: number, { clientX: x, clientY: y }: PointerEvent): void {
    if (index === this.#over) {
      this.#dwell.stop()
      this.#away.stop()
      this.#next = index

      return
    }

    if (index !== this.#next || Math.hypot(x - this.#from.x, y - this.#from.y) > STILL) {
      this.#next = index
      this.#from = { x, y }
      this.#dwell.stop()

      if (index >= 0) this.#dwell.start(index)
    }

    if (this.#over >= 0 && !this.#away.isPending.value) this.#away.start()
  }

  #mount(): void {
    const root = this.root.value!

    this.#elements = dialLens.HALVES.map((half) => [...root.querySelectorAll(`[data-half='${half}']`)])
  }

  #named({ target }: PointerEvent): number {
    const name = (target as Element).closest<HTMLElement>('[role=tab]')

    return name ? Number(name.dataset.index) : -1
  }

  #paint(half: dialLens.Half, open: number): void {
    const level = Math.round(open * dialLens.OPENING_STEPS)

    if (level === this.#shown[half]) return

    this.#shown[half] = level

    const paths = this.#levels![half]![level]!

    for (const [index, element] of this.#elements[half]!.entries()) element.setAttribute('d', paths[index]!)
  }

  #peekAt(index: number): void {
    this.peek.value = index !== this.selected.value ? index : -1

    this.#levels ??= dialLens.HALVES.map((half) =>
      range(dialLens.OPENING_STEPS + 1).map((level) => plot.paths(half, level / dialLens.OPENING_STEPS))
    )

    for (const half of dialLens.HALVES) {
      const twilight = twilights[half]
      const goal     = twilight === this.selected.value ? 1 : twilight === this.peek.value ? PEEK : 0
      const glide    = this.#glides[half]!

      if (glide.goal !== goal) glide.ease(goal)
    }
  }

  #stretchAt({ clientX, clientY }: PointerEvent): number {
    const { center, floor, rim, width } = dialLens.DIAL

    const box    = this.plot.value!.getBoundingClientRect()
    const scale  = width / box.width
    const dx     = (clientX - box.left) * scale - center.x
    const dy     = (clientY - box.top) * scale - center.y
    const radius = Math.hypot(dx, dy)

    if (radius < floor * REACH.floor || radius > rim + REACH.rim) return -1

    const minute = plot.minuteAt(
      Math.atan2(-dx, dy),
      this.#shown.map((level) => level / dialLens.OPENING_STEPS)
    )
    const covers = (index: number) => {
      const [from, to] = marks.spans[index]!

      return [minute, minute + DAY_MINUTES].some((at) => at >= from && at < to)
    }
    const among = (wanted: boolean) =>
      stretches.findIndex(({ outer }, index) => outer === wanted && covers(index))
    const outside = radius > rim + REACH.track ? among(true) : -1

    return outside >= 0 ? outside : among(false)
  }
}

/**
 * Draws one day of the reading around a 24-hour dial with noon at the top, a
 * reader picking one stretch at a time to see what the reading does there and
 * why, each twilight opening to a quarter of the dial once picked and peeking a
 * third of the way there under a resting pointer or the focus on its name.
 */
export const DayEstimate = defineComponent({
  name: 'DayEstimate',
  setup() {
    const picker = new StretchPicker()

    return () => {
      const selected = picker.selected.value
      const peek     = picker.peek.value

      return (
        <div class="widget" ref={picker.root}>
          <div class="day-estimate-board">
            <div
              class="day-estimate-plot"
              onPointerdown={picker.onPointerdown}
              onPointerleave={picker.onPointerleave}
              onPointermove={picker.onPointermove}
              ref={picker.plot}
            >
              {dialDrawing(data, rest, selected, peek)}
              <div aria-label="Stretches of the sample day" class="day-estimate-names" role="tablist">
                {...stretches.map(({ name, place }, index) => (
                  <button
                    aria-controls={panelId(picker.id)}
                    aria-selected={index === selected}
                    class={['day-estimate-tab', { peeked: index === peek }]}
                    data-index={index}
                    id={tabId(picker.id, index)}
                    onBlur={() => picker.hold(-1)}
                    onClick={() => picker.pick(index)}
                    onFocus={() => picker.hold(index)}
                    onKeydown={(event) => picker.names.move(event, index)}
                    ref={(element) => picker.names.keep(element, index)}
                    role="tab"
                    style={{ left: `${place.left}%`, top: `${place.top}%` }}
                    tabindex={index === selected ? 0 : -1}
                    type="button"
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div aria-hidden class={['day-estimate-hub', { peeked: peek >= 0 }]}>
                {layers(stretches.map(hubWords), peek >= 0 ? peek : selected)}
              </div>
            </div>
            <div {...tabPanel(picker.id, selected)} class="day-estimate-side">
              {layers(stretches.map(sideWords), selected)}
            </div>
            {picker.announcer.region}
          </div>
        </div>
      )
    }
  }
})

function hubWords({ caption, figure }: (typeof stretches)[number]): VNode {
  return (
    <div class="day-estimate-hub-words">
      <span class="day-estimate-figure">{figure}</span>
      <span class="day-estimate-caption">{caption}</span>
    </div>
  )
}

function sideWords({ caption, figure, name, span, why }: (typeof stretches)[number]): VNode {
  return (
    <div class="day-estimate-words">
      <p class="day-estimate-head">
        <span class="day-estimate-name">{name}</span>
        <span class="day-estimate-span widget-num">{span}</span>
      </p>
      <p class="day-estimate-why">
        <span class="visually-hidden">{`${figure} ${caption}. `}</span>
        {why}
      </p>
    </div>
  )
}
