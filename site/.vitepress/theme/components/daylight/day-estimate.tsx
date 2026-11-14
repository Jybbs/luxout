import * as tabs                      from '@zag-js/tabs'
import { normalizeProps, useMachine } from '@zag-js/vue'
import { range }                      from 'd3-array'
import { type ComputedRef, type VNode, computed, defineComponent, onMounted, shallowRef, useId } from 'vue'

import { DAY_MINUTES }           from '../../../lib/daylight/clock.ts'
import { data }                  from '../../../lib/daylight/day-dial.data.ts'
import * as dialLens             from '../../../lib/daylight/dial-lens.ts'
import { Glide }                 from '../../../lib/motion/glide.ts'
import { Speech }                from '../../../lib/motion/speech.ts'
import { DURATIONS }             from '../../../lib/motion/timing.ts'
import { layers }                from '../../controls/layers.tsx'
import { Pauses }                from '../../controls/pauses.ts'
import { tabPanel, tabsContext } from '../../controls/tablist.tsx'
import { dialDrawing }           from './dial-drawing.tsx'

const { marks, opens, stretches } = data

/**
 * The utilities the plot draws each mark of the dial in, by the class the mark
 * carries, a stretch's bracket and reading lit while it is picked and its
 * bracket alone drawn while it is peeked at.
 */
const MARKS = [
  'day-estimate-plot relative [&>svg]:block [&>svg]:h-auto [&>svg]:w-full',
  '[&_.day-estimate-wash-0]:fill-dial-wash-0 [&_.day-estimate-wash-1]:fill-dial-wash-1',
  '[&_.day-estimate-wash-2]:fill-dial-wash-2 [&_.day-estimate-wash-3]:fill-dial-wash-3',
  '[&_.day-estimate-sky]:fill-sky-fill',
  '[&_:is(.day-estimate-edge,.day-estimate-rim,.day-estimate-floor,.day-estimate-quiet)]:fill-none',
  '[&_:is(.day-estimate-cover,.day-estimate-fall,.day-estimate-tick)]:fill-none',
  '[&_:is(.day-estimate-bracket,.day-estimate-line)]:fill-none',
  '[&_.day-estimate-edge]:stroke-ink [&_.day-estimate-edge]:stroke-[1.2]',
  '[&_.day-estimate-rim]:stroke-rule [&_.day-estimate-rim]:stroke-1',
  '[&_.day-estimate-floor]:stroke-muted [&_.day-estimate-floor]:stroke-1',
  '[&_.day-estimate-floor]:[stroke-dasharray:3_3]',
  '[&_.day-estimate-quiet]:stroke-muted [&_.day-estimate-quiet]:stroke-[1.4]',
  '[&_.day-estimate-quiet]:[stroke-linejoin:round]',
  '[&_.day-estimate-cover]:stroke-forecast [&_.day-estimate-cover]:stroke-2',
  '[&_.day-estimate-fall]:stroke-fallback [&_.day-estimate-fall]:stroke-[1.5]',
  '[&_.day-estimate-fall]:[stroke-dasharray:4_3]',
  '[&_.day-estimate-tick]:stroke-muted [&_.day-estimate-tick]:stroke-[1.2]',
  '[&_:is(.day-estimate-tick,.day-estimate-bracket,.day-estimate-line)]:[stroke-linecap:round]',
  '[&_.day-estimate-layer]:opacity-0 [&_.day-estimate-layer]:transition-opacity',
  '[&_.day-estimate-layer]:duration-(--timing-fade)',
  '[&_.day-estimate-layer:is([data-on],[data-peek])]:opacity-100',
  '[&_.day-estimate-bracket]:stroke-ink [&_.day-estimate-bracket]:stroke-2',
  '[&_.day-estimate-bracket]:transition-[stroke] [&_.day-estimate-bracket]:duration-(--timing-hover)',
  '[&_.day-estimate-line]:stroke-estimate [&_.day-estimate-line]:stroke-[2.25]',
  '[&_.day-estimate-line]:[stroke-linejoin:round] [&_.day-estimate-line]:transition-opacity',
  '[&_.day-estimate-line]:duration-(--timing-fade)',
  '[&_.day-estimate-layer[data-peek]:not([data-on])_.day-estimate-bracket]:stroke-muted',
  '[&_.day-estimate-layer[data-peek]:not([data-on])_.day-estimate-line]:opacity-0'
]
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
  readonly id       = useId()
  readonly names    : ComputedRef<tabs.Api>
  readonly peek     = shallowRef(-1)
  readonly plot     = shallowRef<HTMLElement>()
  readonly root     = shallowRef<HTMLElement>()
  readonly selected = shallowRef(opens)
  readonly speech   = new Speech(this.root)

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

  #elements        : readonly (readonly Element[])[] = []
  #from            = { x: 0, y: 0 }
  readonly #glides : readonly Glide[]
  #held            = -1
  #levels          : readonly (readonly (readonly string[])[])[] | undefined
  #next            = -1
  #over            = -1
  readonly #pauses = new Pauses((index: number) => this.#commit(index), () => this.#commit(-1))
  readonly #shown  : number[] = opened.map((open) => open * dialLens.OPENING_STEPS)

  constructor() {
    const names = useMachine(tabs.machine, computed(() => ({
      ...tabsContext(this.id, 'Stretches of the sample day'),
      onValueChange : ({ value }: tabs.ValueChangeDetails) => this.pick(Number(value)),
      value         : String(this.selected.value),
      onFocusChange : ({ focusedValue }: tabs.FocusChangeDetails) => {
        this.hold(focusedValue ? Number(focusedValue) : -1)
      }
    })))

    this.names   = computed(() => tabs.connect(names, normalizeProps))
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
    this.speech.say(`${name}, ${figure} ${caption}`)
    this.#peekAt(this.#held >= 0 ? this.#held : this.#over)
  }

  #commit(index: number): void {
    this.#pauses.leave.stop()
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
      this.#pauses.stop()
      this.#next = index

      return
    }

    if (index !== this.#next || Math.hypot(x - this.#from.x, y - this.#from.y) > STILL) {
      this.#next = index
      this.#from = { x, y }

      if (index >= 0) this.#pauses.dwell.start(index)
      else this.#pauses.dwell.stop()
    }

    if (this.#over >= 0 && !this.#pauses.leave.isPending.value) this.#pauses.leave.start()
  }

  #mount(): void {
    const root = this.root.value!

    this.#elements = dialLens.HALVES.map((half) => [...root.querySelectorAll(`[data-half='${half}']`)])
  }

  #named({ target }: PointerEvent): number {
    const name = (target as Element).closest<HTMLElement>('[role=tab]')

    return name ? Number(name.dataset.value) : -1
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
        <div class="widget day-estimate" ref={picker.root}>
          <div class="grid gap-3.5 @md:grid-cols-[384px_minmax(0,1fr)] @md:items-center @md:gap-6">
            <div
              class={MARKS}
              onPointerdown={picker.onPointerdown}
              onPointerleave={picker.onPointerleave}
              onPointermove={picker.onPointermove}
              ref={picker.plot}
            >
              {dialDrawing(data, rest, selected, peek)}
              <div {...picker.names.value.getListProps()} class="pointer-events-none absolute inset-0">
                {...stretches.map(({ name, place }, index) => (
                  <button
                    {...picker.names.value.getTriggerProps({ value: String(index) })}
                    class={[
                      'day-estimate-tab pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2',
                      'rounded-sm px-1 py-0.5 text-[0.92rem]/[1.3] font-semibold whitespace-nowrap',
                      'transition-colors duration-(--timing-hover) before:absolute before:-inset-1.5',
                      'cursor-pointer data-selected:cursor-default data-selected:underline',
                      'data-selected:decoration-2 data-selected:underline-offset-4 @max-md:text-[0.86rem]',
                      index === peek ? 'peeked text-ink' : 'text-muted hover:text-ink data-selected:text-ink'
                    ]}
                    style={{ left: `${place.left}%`, top: `${place.top}%` }}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div
                aria-hidden
                class={[
                  'day-estimate-hub group pointer-events-none absolute top-1/2 left-1/2 w-[31%]',
                  '-translate-x-1/2 -translate-y-1/2 text-center',
                  { peeked: peek >= 0 }
                ]}
              >
                {layers(stretches.map(hubWords), peek >= 0 ? peek : selected)}
              </div>
            </div>
            <div {...tabPanel(picker.id, selected)} class="day-estimate-side">
              {layers(stretches.map(sideWords), selected)}
            </div>
          </div>
        </div>
      )
    }
  }
})

function hubWords({ caption, figure }: (typeof stretches)[number]): VNode {
  return (
    <div class="grid h-full content-center justify-items-center gap-1.5">
      <span
        class={[
          'day-estimate-figure font-display text-xl/none font-semibold whitespace-nowrap lining-nums',
          'tabular-nums transition-colors duration-(--timing-hover) group-[.peeked]:text-muted'
        ]}
      >
        {figure}
      </span>
      <span class="text-[0.72rem]/[1.3] text-balance text-muted">{caption}</span>
    </div>
  )
}

function sideWords({ caption, figure, name, span, why }: (typeof stretches)[number]): VNode {
  return (
    <div class="grid gap-1.5">
      <p class="m-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span class="day-estimate-name font-display text-[1.05rem]/[1.3] font-semibold">{name}</span>
        <span class="widget-num text-[0.8rem] text-muted">{span}</span>
      </p>
      <p class="day-estimate-why m-0 text-[0.92rem]/[1.55] text-muted">
        <span class="sr-only">{`${figure} ${caption}. `}</span>
        {why}
      </p>
    </div>
  )
}
