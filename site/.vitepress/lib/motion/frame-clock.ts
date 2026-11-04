import { type MaybeComputedElementRef, tryOnScopeDispose, useElementVisibility, whenever } from '@vueuse/core'
import type { ShallowRef } from 'vue'

/**
 * Runs `tick` on each animation frame until it returns `false` or the scope
 * that built the clock ends, requesting no frame while `watched` is off screen.
 */
export class FrameClock {
  #frame   = 0
  #running = false

  readonly #step = (now: number): void => {
    this.#frame   = 0
    this.#running = this.#tick(now)
    this.#request()
  }

  readonly #tick    : (now: number) => boolean
  readonly #visible : ShallowRef<boolean>

  constructor(watched: MaybeComputedElementRef, tick: (now: number) => boolean) {
    this.#tick    = tick
    this.#visible = useElementVisibility(watched, { initialValue: true })

    whenever(this.#visible, () => this.#request())
    tryOnScopeDispose(() => this.stop())
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

  #request(): void {
    if (this.#running && this.#visible.value && !this.#frame) this.#frame = requestAnimationFrame(this.#step)
  }
}
