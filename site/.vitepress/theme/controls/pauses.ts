import { type UseTimeoutFnReturn, useTimeoutFn } from '@vueuse/core'

import { PAUSES } from '../../lib/motion/timing.ts'

/**
 * Times the dwell and leave pauses a widget waits through around a pointer,
 * calling `dwell` or `leave` once its pause passes unless the pause is stopped
 * first, and beginning a pause again on each start.
 */
export class Pauses<Args extends unknown[]> {
  readonly dwell : UseTimeoutFnReturn<(...args: Args) => void>
  readonly leave : UseTimeoutFnReturn<() => void>

  constructor(dwell: (...args: Args) => void, leave: () => void = () => undefined) {
    this.dwell = useTimeoutFn(dwell, PAUSES.dwell, { immediate: false })
    this.leave = useTimeoutFn(leave, PAUSES.leave, { immediate: false })
  }

  /**
   * Stops both pauses, so neither callback runs until a pause starts again.
   */
  stop(): void {
    this.dwell.stop()
    this.leave.stop()
  }
}
