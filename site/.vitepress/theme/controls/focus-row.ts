/**
 * Holds one row's buttons and moves the focus across them per the ARIA patterns
 * for tabs and accordions, on the row's two arrow keys, Home, and End, with the
 * arrow keys wrapping at each end.
 */
export class FocusRow {
  readonly #buttons  : HTMLElement[] = []
  readonly #moved    : ((index: number) => void) | undefined
  readonly #next     : string
  readonly #previous : string

  constructor(next: string, previous: string, moved?: (index: number) => void) {
    this.#moved    = moved
    this.#next     = next
    this.#previous = previous
  }

  keep(element: unknown, index: number): void {
    if (element instanceof HTMLElement) this.#buttons[index] = element
  }

  move(event: KeyboardEvent, index: number): void {
    const count                                   = this.#buttons.length
    const goals: Readonly<Record<string, number>> = {
      End              : count - 1,
      Home             : 0,
      [this.#next]     : (index + 1) % count,
      [this.#previous] : (index - 1 + count) % count
    }
    const goal = goals[event.key]

    if (goal === undefined) return

    event.preventDefault()
    this.#moved?.(goal)
    this.#buttons[goal]!.focus()
  }
}
