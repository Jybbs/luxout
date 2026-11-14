import { type UseTimeoutFnReturn, noop, useTimeoutFn } from '@vueuse/core'

import { PAUSES } from '../../lib/motion/timing.ts'

/**
 * Times the dwell and leave pauses a widget waits through around a pointer,
 * calling `dwell` or `leave` once its pause passes unless the pause is stopped
 * first, and beginning a pause again on each start.
 */
export class Pauses<Args extends unknown[]> {
  readonly dwell : UseTimeoutFnReturn<(...args: Args) => void>
  readonly leave : UseTimeoutFnReturn<() => void>

  constructor(dwell: (...args: Args) => void, leave = noop) {
    this.dwell = useTimeoutFn(dwell, PAUSES.dwell, { immediate: false })
    this.leave = useTimeoutFn(leave, PAUSES.leave, { immediate: false })
  }

  /**
   * Starts the dwell pause for a mouse resting on a target, leaving a touch or
   * a pen to act at once through the widget's own handlers.
   */
  rest(event: PointerEvent, ...args: Args): void {
    if (event.pointerType === 'mouse') this.dwell.start(...args)
  }

  /**
   * Stops both pauses, so neither callback runs until a pause starts again.
   */
  stop(): void {
    this.dwell.stop()
    this.leave.stop()
  }
}
