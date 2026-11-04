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
  rest     : () => void
  set      : (value: number, eased: boolean) => void
  value    : () => number
}

/**
 * Runs a slider laid over a drawing per the ARIA slider pattern, where the
 * arrow keys, Page Up, Page Down, Home, and End ease the value, a press or a
 * drag sets it where the pointer stands, a mouse sets it once it has rested for
 * the dwell pause, and the focus leaving, or a pointer leaving an unfocused
 * slider for the leave pause, returns it to rest.
 */
export class PlotSlider {
  readonly onBlur = (): void => {
    this.#options.rest()
  }

  readonly onKeydown = (event: KeyboardEvent): void => {
    const { count, page, set, value }             = this.#options
    const now                                     = value()
    const last                                    = count - 1
    const goals: Readonly<Record<string, number>> = {
      ArrowDown  : now - 1,
      ArrowLeft  : now - 1,
      ArrowRight : now + 1,
      ArrowUp    : now + 1,
      End        : last,
      Home       : 0,
      PageDown   : now - page,
      PageUp     : now + page
    }
    const goal = goals[event.key]

    if (goal === undefined) return

    event.preventDefault()
    set(clamp(goal, 0, last), true)
  }

  readonly onPointerdown = (event: PointerEvent): void => {
    if (event.button !== 0) return

    const target = event.currentTarget as HTMLElement

    this.#dwell.stop()
    target.setPointerCapture(event.pointerId)
    target.focus({ preventScroll: true })
    this.#dragging = true
    this.#point(event.clientX)
    event.preventDefault()
  }

  readonly onPointerleave = (event: PointerEvent): void => {
    this.#dwell.stop()
    this.#hovering = false
    this.#away.start(event.currentTarget as HTMLElement)
  }

  readonly onPointermove = (event: PointerEvent): void => {
    this.#away.stop()

    if (this.#dragging || this.#hovering) {
      this.#point(event.clientX)
    } else if (event.pointerType === 'mouse') {
      this.#dwell.start(event.clientX)
    }
  }

  readonly onPointerup = (): void => {
    this.#dragging = false
  }

  readonly #away = useTimeoutFn(
    (target: HTMLElement) => {
      if (document.activeElement !== target && !this.#dragging) this.#options.rest()
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

  #hovering         = false
  readonly #options : Options

  constructor(options: Options) {
    this.#options = options
  }

  #point(clientX: number): void {
    this.#options.set(this.#options.position(clientX), false)
  }
}
