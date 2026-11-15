import type { Facts } from './facts.ts'

/**
 * Writes one minute's figures into the elements under a root that name a
 * figure through `data-fact`, marking the root `data-assumed` where no forecast
 * step covers the minute, so a readout shows the clear sky in its place.
 */
export class Readout {
  readonly #fields : readonly HTMLElement[]
  readonly #root   : HTMLElement

  constructor(root: HTMLElement) {
    this.#root   = root
    this.#fields = [...root.querySelectorAll<HTMLElement>('[data-fact]')]
  }

  write(facts: Facts): void {
    for (const element of this.#fields) {
      element.textContent = facts[element.dataset.fact as keyof Facts] ?? '1'
    }

    this.#root.toggleAttribute('data-assumed', facts.factor === null)
  }
}
