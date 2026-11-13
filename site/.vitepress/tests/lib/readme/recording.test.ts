import { expect, it } from 'vitest'

import { record } from '../../../lib/readme/recording.ts'

const PACING = { hold: 1000, seeds: [], step: 20 }

/**
 * Draws a square four pixels on a side filled with `fill`.
 */
function square(fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4">`
    + `<rect width="4" height="4" fill="${fill}"/></svg>`
}

/**
 * Reads the delay of each frame in `gif` from its graphic control extension, in
 * hundredths of a second.
 */
function delays(gif: Uint8Array): number[] {
  return [...gif.keys()]
    .filter((at) => gif[at] === 0x21 && gif[at + 1] === 0xf9 && gif[at + 2] === 4)
    .map((at) => gif[at + 4]! | gif[at + 5]! << 8)
}

it('lengthens the frame before one that changes nothing and holds the last', () => {
  expect(delays(record([square('#ff0000'), square('#ff0000'), square('#0000ff')], PACING))).toEqual([4, 102])
})
