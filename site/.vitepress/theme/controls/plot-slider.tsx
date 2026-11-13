import { useTimeoutFn }                           from '@vueuse/core'
import * as slider                                from '@zag-js/slider'
import { mergeProps, normalizeProps, useMachine } from '@zag-js/vue'
import { type PropType, type VNode, computed, defineComponent, useId } from 'vue'

import { PAUSES } from '../../lib/motion/timing.ts'

/**
 * The utilities the control and its thumb take, beside where a thumb drawn on
 * a track starts.
 */
interface Look {
  readonly control : string | readonly string[]
  readonly thumb   : string | readonly string[]
  /**
   * The thumb's `left` until a motion writes its own, held in the `--at`
   * custom property, since a render writes every key of an inline style again.
   */
  readonly at?: string
}

interface Options {
  count : number
  label : string
  /**
   * The step Page Up and Page Down take, and the Left and Right Arrows with
   * Shift held.
   */
  page : number
  set  : (value: number, eased: boolean) => void
  text : (value: number) => string
  /**
   * Reads the value a widget shows, which the slider takes up as its thumb
   * takes the focus and ahead of each key.
   */
  value: () => number
  /**
   * Moves the value back to rest once the focus or a pointer leaves.
   */
  rest?: () => void
}

/**
 * The stretch of a drawing's width a plot takes, in the units of its `viewBox`.
 */
interface PlotSpan {
  readonly left  : number
  readonly right : number
  readonly width : number
}

/**
 * The look of a slider laid over a drawing, whose control spans the plot the
 * `--plot-left` and `--plot-right` custom properties set, or the first layout's
 * where neither is set, and whose thumb covers the whole drawing, so the focus
 * ring outlines it.
 */
export const OVERLAY: Look = { control: 'widget-slider', thumb: 'widget-cover' }

/**
 * Runs a slider laid over a drawing on Zag's slider machine, which steps the
 * value on the arrow keys, Page Up, Page Down, Home, and End and sets it where
 * a press or a drag stands, `set` easing the widget to each value a key sets.
 * The slider adds the Up and Down Arrows the machine leaves to a vertical
 * slider, a mouse setting the value once it has rested for the dwell pause, and
 * the focus leaving, or a pointer leaving an unfocused slider for the leave
 * pause, returning it to rest.
 */
export class PlotSlider {
  readonly #api = computed(() => slider.connect(this.#service, normalizeProps))

  readonly #away = useTimeoutFn(
    () => {
      if (!this.#api.value.focused && !this.#api.value.dragging) this.#options.rest?.()
    },
    PAUSES.leave,
    { immediate: false }
  )

  readonly #control = {
    onPointerdown: () => this.#dwell.stop(),

    onPointerleave: () => {
      this.#dwell.stop()
      this.#hovering = false
      this.#away.start()
    },

    onPointermove: (event: PointerEvent) => {
      this.#away.stop()

      if (this.#api.value.dragging) return

      if (this.#hovering) {
        this.#follow(event.currentTarget as Element, event.clientX)
      } else if (event.pointerType === 'mouse') {
        this.#dwell.start(event.currentTarget as Element, event.clientX)
      }
    }
  }

  readonly #dwell = useTimeoutFn(
    (control: Element, clientX: number) => {
      this.#hovering = true
      this.#follow(control, clientX)
    },
    PAUSES.dwell,
    { immediate: false }
  )

  #holding          = false
  #hovering         = false
  readonly #options : Options
  #pointing         = false
  readonly #service : slider.Service

  readonly #thumb = {
    onFocusin  : () => this.hold(this.#options.value()),
    onFocusout : () => this.#options.rest?.(),
    onKeydown  : (event: KeyboardEvent) => {
      this.hold(this.#options.value())

      const step = { ArrowDown: this.#api.value.decrement, ArrowUp: this.#api.value.increment }[event.key]

      if (!step) return

      event.preventDefault()
      step(0)
    }
  }

  constructor(options: Options) {
    this.#options = options
    this.#service = useMachine(slider.machine, {
      'aria-label'     : [options.label],
      defaultValue     : [options.value()],
      getAriaValueText : ({ value }) => options.text(value),
      id               : useId(),
      largeStep        : options.page,
      max              : options.count - 1,
      onValueChange    : ({ value }) => this.#change(value[0]!),
      thumbAlignment   : 'center'
    })
  }

  /**
   * Sets the machine's value to `value` without moving the widget, for a value
   * the widget reached on its own, such as its rest.
   */
  hold(value: number): void {
    this.#holding = true
    this.#api.value.setValue([value])
    this.#holding = false
  }

  /**
   * Draws the control around `children`, with the thumb after them, in a
   * component of its own, so a change of the machine's state renders nothing
   * of the widget around it.
   */
  render(look: Look, children?: () => VNode[]): VNode {
    return <SliderView draw={() => this.#draw(look, children?.() ?? [])} />
  }

  #change(value: number): void {
    if (!this.#holding) this.#options.set(value, !this.#pointing && !this.#api.value.dragging)
  }

  #draw(look: Look, children: VNode[]): VNode {
    const { style: _control, ...control }                         = this.#api.value.getControlProps()
    const { 'aria-labelledby': _label, style: _thumb, ...thumb } = this.#api.value.getThumbProps({ index: 0 })

    return (
      <div {...mergeProps(control, this.#control)} class={look.control}>
        {...children}
        <div
          {...mergeProps(thumb, this.#thumb)}
          class={[look.thumb, look.at && 'left-(--at)']}
          style={look.at && { '--at': look.at }}
        />
      </div>
    )
  }

  #follow(control: Element, clientX: number): void {
    const { left, width } = control.getBoundingClientRect()

    this.#pointing = true
    this.#api.value.setThumbValue(0, this.#api.value.getPercentValue((clientX - left) / width))
    this.#pointing = false
  }
}

/**
 * Renders a slider through `draw` on its own, so the machine's state is read
 * inside this component alone.
 */
const SliderView = defineComponent({
  name  : 'SliderView',
  props : { draw: { required: true, type: Function as PropType<() => VNode> } },
  setup(props) {
    return () => props.draw()
  }
})

/**
 * Builds the custom properties holding where each layout's plot starts and ends
 * as fractions of its drawing, `--plot-left-0` and `--plot-right-0` for the
 * first layout and so on. The slider spans the first layout's plot unless a
 * widget's breakpoint utilities read a later one's into `--plot-left` and
 * `--plot-right`.
 */
export function plotSpans(spans: readonly PlotSpan[]): Readonly<Record<string, string>> {
  return Object.fromEntries(spans.flatMap(({ left, right, width }, index) => [
    [`--plot-left-${index}`, String(left / width)],
    [`--plot-right-${index}`, String(right / width)]
  ]))
}
