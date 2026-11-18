import { renderAsync }                                   from '@resvg/resvg-js'
import { type Color, GIFEncoder, applyPalette, quantize } from 'gifenc/dist/gifenc.esm.js'

import { channelsOf } from '../cards/sky.ts'

/**
 * One frame of a recording, its pixels as palette indices.
 */
interface Frame {
  delay : number
  index : Uint8Array
}

/**
 * How long a recording shows each frame and holds its last, in milliseconds,
 * and the colors its palette opens on.
 */
interface Pacing {
  hold  : number
  seeds : readonly string[]
  step  : number
}

const BATCH   = 4    // The frames rasterized at once, one per thread of the four in libuv's default pool
const CLOSE   = 12   // The squared distance in channel steps that marks a sampled color as one already held
const COLORS  = 255  // The palette's color limit, the index after its last marking the pixels a frame keeps
const FILLER  = [255, 0, 255] as const
const SAMPLES = 24   // The fewest frames sampled for the palette, or every frame of a shorter recording

/**
 * Builds the palette from `seeds`, then fills the rest of it with the colors
 * `samples` quantize to, leaving out each color within `CLOSE` of one already
 * held.
 */
function paletteOf(samples: readonly Uint8Array[], seeds: readonly string[]): Color[] {
  const held    = [...new Set(seeds)].map(channelsOf).slice(0, COLORS)
  const sampled = quantize(new Uint8Array(Buffer.concat(samples)), COLORS, { format: 'rgb444' })
  const apart   = (palette: readonly Color[], color: Color) =>
    palette.every((own) => own.reduce((sum, channel, at) => sum + (channel - color[at]!) ** 2, 0) > CLOSE)

  return sampled.reduce(
    (palette, color) => palette.length < COLORS && apart(palette, color) ? [...palette, color] : palette,
    held
  )
}

/**
 * Rasterizes `drawing` with no system fonts, off the main thread.
 */
async function raster(drawing: string): Promise<{ height: number, pixels: Uint8Array, width: number }> {
  const { height, pixels, width } = await renderAsync(drawing, { font: { loadSystemFonts: false } })

  return { height, pixels, width }
}

/**
 * Encodes `drawings`, each an SVG document, as a GIF that loops without end,
 * every frame rasterized through `@resvg/resvg-js` and mapped onto one palette.
 * Each pixel a frame leaves unchanged is written transparent over the frame
 * before it, and a frame that changes nothing lengthens the one before it.
 */
export async function record(
  drawings              : readonly string[],
  { hold, seeds, step } : Pacing
): Promise<Uint8Array> {
  const every             = Math.max(1, Math.floor(drawings.length / SAMPLES))
  const samples           = new Map(await Promise.all(drawings.keys()
    .filter((at) => at % every === 0)
    .map(async (at) => [at, await raster(drawings[at]!)] as const)))
  const { height, width } = samples.get(0)!
  const palette           = paletteOf(Array.from(samples.values(), ({ pixels }) => pixels), seeds)
  const kept              = palette.length
  const gif               = GIFEncoder()

  const frames : Frame[]    = []
  let shown    : Uint8Array = new Uint8Array()

  for (let start = 0; start < drawings.length; start += BATCH) {
    const batch = drawings.slice(start, start + BATCH)
    const shots = batch.map(async (drawing, at) => samples.get(start + at) ?? raster(drawing))

    for (const { pixels } of await Promise.all(shots)) {
      const index   = applyPalette(pixels, palette)
      const changes = index.map((color, at) => color === shown[at] ? kept : color)
      const last    = frames.at(-1)

      if (last !== undefined && changes.every((color) => color === kept)) last.delay += step
      else frames.push({ delay: step, index: changes })
      shown = index
    }
  }
  frames.at(-1)!.delay += hold
  frames.forEach(({ delay, index }, at) => gif.writeFrame(index, width, height, {
    delay            : delay,
    dispose          : 1,
    palette          : at === 0 ? [...palette, FILLER] : undefined,
    repeat           : 0,
    transparent      : true,
    transparentIndex : kept
  }))
  gif.finish()

  return gif.bytes()
}
