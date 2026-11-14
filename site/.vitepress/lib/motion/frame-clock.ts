import { type MaybeComputedElementRef, tryOnScopeDispose, useElementVisibility, whenever } from '@vueuse/core'
import { type ShallowRef, watch } from 'vue'

import { useMotion } from './motion.ts'

/**
 * Runs `tick` on each animation frame until it returns `false` or the scope
 * that built the clock ends, requesting no frame while `watched` is off screen
 * or while the site's drawings are paused. The time `tick` receives leaves out
 * every span the site spent paused, so a drawing resumes where it stood.
 */
export class FrameClock {
  #frame           = 0
  #held            = 0
  #heldAt          = 0
  readonly #paused = useMotion().paused
  #running         = false

  readonly #step = (now: number): void => {
    this.#frame   = 0
    this.#running = this.#tick(now - this.#held)
    this.#request()
  }

  readonly #tick    : (now: number) => boolean
  readonly #visible : ShallowRef<boolean>

  constructor(watched: MaybeComputedElementRef, tick: (now: number) => boolean) {
    this.#heldAt  = performance.now()
    this.#tick    = tick
    this.#visible = useElementVisibility(watched, { initialValue: true })

    whenever(this.#visible, () => this.#request())
    watch(this.#paused, (paused) => paused ? this.#hold() : this.#resume())
    tryOnScopeDispose(() => this.stop())
  }

  /**
   * Reads the clock's time, the time `tick` receives, which stands still while
   * the site's drawings are paused.
   */
  now(): number {
    return (this.#paused.value ? this.#heldAt : performance.now()) - this.#held
  }

  start(): void {
    this.#running = true
    this.#request()
  }

  stop(): void {
    this.#running = false
    cancelAnimationFrame(this.#frame)
    this.#frame = 0
  }

  #hold(): void {
    this.#heldAt = performance.now()
    cancelAnimationFrame(this.#frame)
    this.#frame = 0
  }

  #request(): void {
    if (this.#running && this.#visible.value && !this.#paused.value && !this.#frame) {
      this.#frame = requestAnimationFrame(this.#step)
    }
  }

  #resume(): void {
    this.#held += performance.now() - this.#heldAt
    this.#request()
  }
}
