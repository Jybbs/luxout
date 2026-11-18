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

const CLOSE  = 12   // The squared distance in channel steps that marks a quantized color as one already held
const COLORS = 255  // The palette's color limit, the index after its last marking the pixels a frame keeps
const FILLER = [255, 0, 255] as const

/**
 * Builds the palette from `seeds`, then fills the rest of it with the colors
 * `pixels` quantize to as one image, leaving out each color within `CLOSE` of
 * one already held.
 */
function paletteOf(pixels: Uint8Array, seeds: readonly string[]): Color[] {
  const held      = [...new Set(seeds)].map(channelsOf).slice(0, COLORS)
  const quantized = quantize(pixels, COLORS, { format: 'rgb444' })
  const apart     = (palette: readonly Color[], color: Color) =>
    palette.every((own) => own.reduce((sum, channel, at) => sum + (channel - color[at]!) ** 2, 0) > CLOSE)

  return quantized.reduce(
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
 * every frame rasterized through `@resvg/resvg-js` and mapped onto one palette
 * built from the colors every frame shows. Each pixel a frame leaves unchanged
 * is written transparent over the frame before it, and a frame that changes
 * nothing lengthens the one before it.
 */
export async function record(
  drawings              : readonly string[],
  { hold, seeds, step } : Pacing
): Promise<Uint8Array> {
  const { height, pixels: first, width } = await raster(drawings[0]!)
  const size                             = first.length
  const pixels                           = new Uint8Array(drawings.length * size)
  const rest                             = drawings.slice(1).map(async (drawing, at) =>
    pixels.set((await raster(drawing)).pixels, (at + 1) * size))

  pixels.set(first)
  await Promise.all(rest)

  const palette = paletteOf(pixels, seeds)
  const kept    = palette.length
  const gif     = GIFEncoder()

  const frames : Frame[]    = []
  let shown    : Uint8Array = new Uint8Array()

  // Copies each frame out of `pixels`, since `applyPalette` reads the whole buffer beneath a view
  for (let start = 0; start < pixels.length; start += size) {
    const index   = applyPalette(pixels.slice(start, start + size), palette)
    const changes = index.map((color, at) => color === shown[at] ? kept : color)
    const last    = frames.at(-1)

    if (last !== undefined && changes.every((color) => color === kept)) last.delay += step
    else frames.push({ delay: step, index: changes })
    shown = index
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
