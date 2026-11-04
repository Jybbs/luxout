import { type MaybeComputedElementRef, clamp } from '@vueuse/core'

import { FrameClock }               from './frame-clock.ts'
import { DURATIONS, motionReduced } from './timing.ts'

/**
 * Moves a value along smoothstep to each new goal over the `move` duration,
 * starting from wherever the value stands when the goal arrives, writing the
 * value on each frame and reporting once the motion ends.
 */
export class Glide {
  goal              : number
  readonly #clock   : FrameClock
  #from             : number
  readonly #settled : () => void
  #start            : number
  #value            : number
  readonly #write   : (value: number) => void

  constructor(
    value   : number,
    watched : MaybeComputedElementRef,
    settled : () => void,
    write   : (value: number) => void
  ) {
    this.goal     = value
    this.#clock   = new FrameClock(watched, (now) => this.#advance(now))
    this.#from    = value
    this.#settled = settled
    this.#start   = 0
    this.#value   = value
    this.#write   = write
  }

  /**
   * Eases toward `goal`, or snaps to it under `prefers-reduced-motion`.
   */
  ease(goal: number): void {
    if (motionReduced()) {
      this.snap(goal)

      return
    }

    this.goal   = goal
    this.#from  = this.#value
    this.#start = performance.now()
    this.#clock.start()
  }

  snap(goal: number): void {
    this.#clock.stop()
    this.goal   = goal
    this.#value = goal
    this.#write(goal)
    this.#settled()
  }

  #advance(now: number): boolean {
    const done = clamp((now - this.#start) / DURATIONS.move, 0, 1)

    this.#value = this.#from + (this.goal - this.#from) * done * done * (3 - 2 * done)
    this.#write(this.#value)

    if (done < 1) return true

    this.#settled()

    return false
  }
}
