import { clamp } from '@vueuse/core'

import * as format       from '../daylight/format.ts'
import type { FrontDay } from './front.ts'

/**
 * What the front page prints for one minute of the sample day, each figure in
 * the form a readout shows.
 */
export interface Facts {
  /**
   * The end of HomeKit's range the clear sky lies past, as `<` or `>`, and
   * empty inside the range.
   */
  readonly beyond  : '' | '<' | '>'
  readonly clear   : string         // The clear-sky lux held inside HomeKit's range
  readonly factor  : string | null  // `null` where no forecast step covers the minute
  readonly phase   : string
  readonly reading : string
  readonly sun     : string
  readonly time    : string
}

/**
 * Reads the figures of `minute` past midnight off `day`, rounding the minute to
 * the whole minute it falls in.
 */
export function factsAt(day: FrontDay, minute: number): Facts {
  const at     = Math.round(clamp(minute, 0, day.readings.length - 1))
  const lux    = day.clearSkies[at]!
  const factor = day.factors[at]!

  return {
    beyond  : lux < day.range.min ? '<' : lux > day.range.max ? '>' : '',
    clear   : format.formatLux(clamp(lux, day.range.min, day.range.max)),
    factor  : factor === null ? null : format.formatFactor(factor),
    phase   : day.phases.findLast(({ from }) => from <= at)!.name,
    reading : format.formatLux(day.readings[at]!),
    sun     : format.formatDegrees(day.altitudes[at]!),
    time    : format.formatClock(at)
  }
}

/**
 * Places `lux` along HomeKit's range on its logarithmic scale, `0` at its floor
 * and `1` at its ceiling.
 */
export function positionOf(day: FrontDay, lux: number): number {
  const { max, min } = day.range

  return clamp(Math.log10(Math.max(lux, min) / min) / Math.log10(max / min), 0, 1)
}

/**
 * Reads `values` at `minute` past midnight, between the two whole minutes
 * around it.
 */
export function valueAt(values: readonly number[], minute: number): number {
  const at    = clamp(minute, 0, values.length - 1)
  const whole = Math.min(Math.floor(at), values.length - 2)

  return values[whole]! + (values[whole + 1]! - values[whole]!) * (at - whole)
}
