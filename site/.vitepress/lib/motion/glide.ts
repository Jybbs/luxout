import type { MaybeComputedElementRef } from '@vueuse/core'

import { FrameClock } from './frame-clock.ts'
import { useMotion }  from './motion.ts'
import * as timing    from './timing.ts'

/**
 * Moves a value along smoothstep to each new goal over `duration`, starting
 * from the value it holds when the goal arrives, writing the value on each
 * frame and reporting once the motion ends.
 */
export class Glide {
  goal               : number
  readonly #clock    : FrameClock
  readonly #duration : number
  #from              : number
  readonly #paused   = useMotion().paused
  readonly #settled  : () => void
  #start             : number
  #value             : number
  readonly #write    : (value: number) => void

  constructor(
    value    : number,
    watched  : MaybeComputedElementRef,
    settled  : () => void,
    write    : (value: number) => void,
    duration : number = timing.DURATIONS.move
  ) {
    this.goal      = value
    this.#clock    = new FrameClock(watched, (now) => this.#advance(now))
    this.#duration = duration
    this.#from     = value
    this.#settled  = settled
    this.#start    = 0
    this.#value    = value
    this.#write    = write
  }

  /**
   * Eases toward `goal`, or snaps to it under `prefers-reduced-motion` or while
   * the site's drawings are paused.
   */
  ease(goal: number): void {
    if (timing.motionReduced() || this.#paused.value) {
      this.snap(goal)

      return
    }

    this.goal   = goal
    this.#from  = this.#value
    this.#start = this.#clock.now()
    this.#clock.start()
  }

  /**
   * Eases toward `goal` where `eased` holds, and snaps to it otherwise.
   */
  move(goal: number, eased: boolean): void {
    if (eased) this.ease(goal)
    else this.snap(goal)
  }

  snap(goal: number): void {
    this.#clock.stop()
    this.goal   = goal
    this.#value = goal
    this.#write(goal)
    this.#settled()
  }

  #advance(now: number): boolean {
    const done = (now - this.#start) / this.#duration

    this.#value = this.#from + (this.goal - this.#from) * timing.smoothstep(done)
    this.#write(this.#value)

    if (done < 1) return true

    this.#settled()

    return false
  }
}
