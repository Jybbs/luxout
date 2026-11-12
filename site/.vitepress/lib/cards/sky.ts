import { formatHex, interpolate, rgb, wcagContrast } from 'culori'
import { range }                                     from 'd3-array'
import { scaleLog }                                  from 'd3-scale'

import { luxRange } from '../daylight/homekit.ts'
import { skyShade } from '../daylight/sky-ramp.ts'

type Channels = readonly [red: number, green: number, blue: number]

const STEPS  = 255
const scale  = scaleLog([luxRange.min, luxRange.max], [0, STEPS]).clamp(true)
const shades = range(STEPS + 1).map((step) => skyShade(step / STEPS).fill)
const parsed = shades.map((shade): Channels => {
  const { b, g, r } = rgb(shade)!

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
})

function stepOf(lux: number): number {
  return Math.round(scale(lux))
}

/**
 * Reads the sky's color at `lux` as channels from 0 to 255.
 */
export function channelsAt(lux: number): Channels {
  return parsed[stepOf(lux)]!
}

/**
 * Reads the sky's color at `lux`, whose position along the ramp is its place on
 * the logarithmic scale of HomeKit's range.
 */
export function colorAt(lux: number): string {
  return shades[stepOf(lux)]!
}

/**
 * Moves `hue` toward `toward` until it holds `ratio` against `ground`,
 * returning `toward` itself where no share of the two holds it.
 */
export function holding(ground: string, hue: string, ratio: number, toward: string): string {
  return range(0, 1, 0.02)
    .map((share) => mix(hue, toward, share))
    .find((color) => wcagContrast(color, ground) >= ratio) ?? toward
}

/**
 * Mixes `share` of `to` into `from`.
 */
export function mix(from: string, to: string, share: number): string {
  return formatHex(interpolate([from, to], 'rgb')(share))
}
