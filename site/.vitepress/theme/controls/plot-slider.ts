import { clamp, useTimeoutFn } from '@vueuse/core'

import { PAUSES } from '../../lib/motion/timing.ts'

interface Options {
  count: number
  /**
   * How far Page Up and Page Down step.
   */
  page: number
  /**
   * Finds the value under a pointer.
   */
  position : (clientX: number) => number
  set      : (value: number, eased: boolean) => void
  value    : () => number
  /**
   * Moves the value back to rest once the focus or a pointer leaves.
   */
  rest?: () => void
}

/**
 * The stretch of a drawing's width a plot takes, in the units of its `viewBox`.
 */
interface PlotSpan {
  left  : number
  right : number
  width : number
}

const WHOLE: PlotSpan = { left: 0, right: 1, width: 1 }

/**
 * Runs a slider laid over a drawing per the ARIA slider pattern, where the
 * arrow keys, Page Up, Page Down, Home, and End ease the value, a press or a
 * drag sets it where the pointer stands, a mouse sets it once it has rested for
 * the dwell pause, and the focus leaving, or a pointer leaving an unfocused
 * slider for the leave pause, returns it to rest.
 */
export class PlotSlider {
  readonly #away = useTimeoutFn(
    (target: HTMLElement) => {
      if (document.activeElement !== target && !this.#dragging) this.#options.rest?.()
    },
    PAUSES.leave,
    { immediate: false }
  )

  #dragging = false

  readonly #dwell = useTimeoutFn(
    (clientX: number) => {
      this.#hovering = true
      this.#point(clientX)
    },
    PAUSES.dwell,
    { immediate: false }
  )

  #hovering = false

  readonly #onBlur = (): void => {
    this.#options.rest?.()
  }

  readonly #onKeydown = (event: KeyboardEvent): void => {
    const { count, page, set, value } = this.#options

    const now  = value()
    const last = count - 1
    const goal = {
      ArrowDown  : now - 1,
      ArrowLeft  : now - 1,
      ArrowRight : now + 1,
      ArrowUp    : now + 1,
      End        : last,
      Home       : 0,
      PageDown   : now - page,
      PageUp     : now + page
    }[event.key]

    if (goal === undefined) return

    event.preventDefault()
    set(clamp(goal, 0, last), true)
  }

  readonly #onPointerdown = (event: PointerEvent): void => {
    if (event.button !== 0) return

    const target = event.currentTarget as HTMLElement

    this.#dwell.stop()
    target.setPointerCapture(event.pointerId)
    target.focus({ preventScroll: true })
    this.#dragging = true
    this.#point(event.clientX)
    event.preventDefault()
  }

  readonly #onPointerleave = (event: PointerEvent): void => {
    this.#dwell.stop()
    this.#hovering = false
    this.#away.start(event.currentTarget as HTMLElement)
  }

  readonly #onPointermove = (event: PointerEvent): void => {
    this.#away.stop()

    if (this.#dragging || this.#hovering) {
      this.#point(event.clientX)
    } else if (event.pointerType === 'mouse') {
      this.#dwell.start(event.clientX)
    }
  }

  readonly #onPointerup = (): void => {
    this.#dragging = false
  }

  readonly #options: Options

  constructor(options: Options) {
    this.#options = options
  }

  /**
   * The listeners an element binds to run the slider, a cancelled pointer
   * ending a drag as a lifted one does.
   */
  get listeners() {
    return {
      onBlur          : this.#onBlur,
      onKeydown       : this.#onKeydown,
      onPointercancel : this.#onPointerup,
      onPointerdown   : this.#onPointerdown,
      onPointerleave  : this.#onPointerleave,
      onPointermove   : this.#onPointermove,
      onPointerup     : this.#onPointerup
    }
  }

  /**
   * Builds the attributes and the listeners an element spreads to run the
   * slider, labeled `label` with the value `now`, which `text` gives in words.
   */
  attributes(label: string, now: number, text?: string) {
    return {
      'aria-label'     : label,
      'aria-valuemax'  : this.#options.count - 1,
      'aria-valuemin'  : 0,
      'aria-valuenow'  : now,
      'aria-valuetext' : text,
      role             : 'slider',
      tabindex         : 0,
      ...this.listeners
    }
  }

  #point(clientX: number): void {
    this.#options.set(this.#options.position(clientX), false)
  }
}

/**
 * Finds how far along a plot a pointer at `clientX` lies, from 0 to 1 and
 * clamped to the plot, which spans the whole of `element` unless `plot` names a
 * narrower span.
 */
export function shareAcross(element: Element, clientX: number, plot: PlotSpan = WHOLE): number {
  const { left, width } = element.getBoundingClientRect()

  return clamp(((clientX - left) * plot.width / width - plot.left) / (plot.right - plot.left), 0, 1)
}
