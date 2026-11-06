import { line } from 'd3-shape'

import { DAY_MINUTES }                from './clock.ts'
import { formatClock, formatDegrees } from './format.ts'
import { tenth }                      from './tenth.ts'

/**
 * One day of the year The Sun's Path draws, each minute on the local clock.
 */
export interface SunDay {
  readonly altitudes : readonly number[]  // Degrees, one sample every `SUN_GRID` minutes
  readonly peak      : { readonly altitude: number, readonly minute: number }
  readonly rise      : number
  readonly set       : number
}

/**
 * The sizes one layout of The Sun's Path holds, in the units of its `viewBox`.
 */
interface SunSizes {
  readonly disc    : number
  readonly glow    : number
  readonly height  : number
  readonly horizon : number
  readonly left    : number
  readonly right   : number
  readonly top     : number
  readonly width   : number
}

export const SUN_GRID    = 30      // Minutes between a day's samples
export const SUNSET      = -5 / 6  // The altitude in degrees of sunrise and sunset
export const SUNSET_WORD = '−5/6°'
const curve              = line<number>()
  .digits(1)
  .x((_, index) => index * SUN_GRID)
  .y((altitude) => -altitude)

/**
 * One size The Sun's Path draws at, placing the clock across it and the sun's
 * altitude up it.
 */
export class SunLayout {
  readonly disc    : number
  readonly glow    : number
  readonly height  : number
  readonly horizon : number
  readonly left    : number
  readonly right   : number
  readonly top     : number
  readonly width   : number

  constructor(sizes: SunSizes) {
    this.disc    = sizes.disc
    this.glow    = sizes.glow
    this.height  = sizes.height
    this.horizon = sizes.horizon
    this.left    = sizes.left
    this.right   = sizes.right
    this.top     = sizes.top
    this.width   = sizes.width
  }

  /**
   * Writes the move that places a mark on `minute` of the clock.
   */
  moveAcross(minute: number): string {
    return `translate(${this.xOf(minute)} 0)`
  }

  /**
   * Writes the move that places the word over the top of `day`'s path.
   */
  moveOver({ peak }: SunDay): string {
    return `translate(${this.xOf(peak.minute)} ${tenth(this.yOf(peak.altitude) - 12)})`
  }

  /**
   * Writes the move that places the top of `day`'s path at its height.
   */
  moveTo({ peak }: SunDay): string {
    return `translate(${this.xOf(peak.minute)} ${this.yOf(peak.altitude)})`
  }

  /**
   * Writes the move that places the sun at `altitude` up the layout.
   */
  moveUp(altitude: number): string {
    return `translate(0 ${this.yOf(altitude)})`
  }

  /**
   * Finds the horizontal position of `minute` of the clock.
   */
  xOf(minute: number): number {
    return tenth(this.left + (this.right - this.left) * minute / DAY_MINUTES)
  }

  /**
   * Finds the vertical position of `altitude`.
   */
  yOf(altitude: number): number {
    return tenth(this.horizon - (this.horizon - this.top) * altitude / 90)
  }
}

export const SUN_LAYOUTS: readonly [SunLayout, SunLayout] = [
  new SunLayout({ disc: 8, glow: 22, height: 212, horizon: 174, left: 30, right: 352, top: 20, width: 360 }),
  new SunLayout({ disc: 9, glow: 26, height: 236, horizon: 198, left: 30, right: 612, top: 20, width: 620 })
]

function where(altitude: number): string {
  return `${formatDegrees(Math.abs(altitude))} ${altitude >= 0 ? 'above' : 'below'} the horizon`
}

/**
 * Finds the sun's altitude on `day` at `minute`, on the straight line between
 * the two samples around it, so the sun stands on the curve drawn through them.
 */
export function altitudeOn({ altitudes }: SunDay, minute: number): number {
  const at    = minute / SUN_GRID
  const index = Math.floor(at)
  const low   = altitudes[index]!

  return low + (altitudes[index + 1]! - low) * (at - index)
}

/**
 * Writes an altitude to a tenth of a degree, or as the exact fraction at
 * sunset, where a tenth would name another point on the curve.
 */
export function altitudeWord(altitude: number): string {
  return altitude === SUNSET ? SUNSET_WORD : formatDegrees(altitude)
}

/**
 * Writes the top of the sun's path on `day`, as its height and its clock time.
 */
export function peakWord({ peak }: SunDay): string {
  return `${formatDegrees(peak.altitude)} at ${formatClock(peak.minute)}`
}

/**
 * Draws the sun's height through a day as a path in a `viewBox` of minutes
 * across and degrees up, the horizon on 0, so one path serves every layout.
 */
export function sunCurve({ altitudes }: SunDay): string {
  return curve(altitudes)!
}

/**
 * Writes where the sun stands on `day` at `minute` and where it moves next, as
 * a clause a sentence can open on.
 */
export function sunPhrase(day: SunDay, altitude: number, minute: number): string {
  const { peak, rise, set } = day

  if (altitude >= SUNSET) {
    return minute < peak.minute
      ? `the sun stands ${where(altitude)}, climbing toward ${peakWord(day)}.`
      : `the sun stands ${where(altitude)}, sinking toward sunset at ${formatClock(set)}.`
  }

  return minute < peak.minute
    ? `the sun is ${where(altitude)} and rises at ${formatClock(rise)}.`
    : `the sun is ${where(altitude)}, having set at ${formatClock(set)}.`
}
