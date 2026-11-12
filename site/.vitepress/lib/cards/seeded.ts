/**
 * Builds a mulberry32 generator, so a card draws the same stars and houses on
 * every build.
 *
 * Returns:
 *   A function returning the sequence's next value in the range from 0 to 1.
 */
export function seeded(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0

    const mixed = Math.imul(state ^ (state >>> 15), state | 1)
    const round = mixed ^ (mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61))

    return ((round ^ (round >>> 14)) >>> 0) / 2 ** 32
  }
}
