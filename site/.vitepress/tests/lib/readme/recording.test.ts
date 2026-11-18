import { expect, it } from 'vitest'

import { record } from '../../../lib/readme/recording.ts'

const PACING = { hold: 1000, seeds: [], step: 20 }

/**
 * Reads each color of the global color table in `gif` as its red, green, and
 * blue channels, the table's size taken from the low three bits of the logical
 * screen descriptor's packed byte.
 */
function colors(gif: Uint8Array): number[][] {
  const table = gif.subarray(13, 13 + 3 * 2 ** ((gif[10]! & 0b111) + 1))

  return Array.from({ length: table.length / 3 }, (_, at) => [...table.subarray(3 * at, 3 * at + 3)])
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

/**
 * Draws a square four pixels on a side filled with `fill`.
 */
function square(fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4">`
    + `<rect width="4" height="4" fill="${fill}"/></svg>`
}

/**
 * Draws fifty red squares, the one at `blue` filled blue.
 */
function strip(blue: number): string[] {
  return Array.from({ length: 50 }, (_, at) => square(at === blue ? '#0000ff' : '#ff0000'))
}

it('lengthens the frame before one that changes nothing and holds the last', async () => {
  const gif = await record([square('#ff0000'), square('#ff0000'), square('#0000ff')], PACING)

  expect(delays(gif)).toEqual([4, 102])
})

it('writes the frames in the order drawn, each run of unchanged frames as one', async () => {
  expect(delays(await record(strip(4), PACING))).toEqual([8, 2, 190])
})

it('keeps a color only one frame of fifty shows in the palette', async () => {
  expect(colors(await record(strip(5), PACING))).toContainEqual([0, 0, 255])
})
