import * as v from '@badrap/valita'

import schema                   from '../../config.schema.json' with { type: 'json' }
import { bounded, keysAtFault } from './fields.js'

/**
 * Matches the rule HAP-NodeJS checks every accessory and service name against,
 * two or more letters, numbers, spaces, apostrophes, and the marks
 * `&!._:;()/,-` that start and end on a letter or a number.
 */
const HOMEKIT_NAME = /^[\p{L}\p{N}][\p{L}\p{N}\p{Zs}\u2019'&!._:;()/,-]*[\p{L}\p{N}]$/u
const fields       = schema.schema.properties.thresholds.items.properties
const named        = v.string()
  .assert((name) => name.length <= fields.name.maxLength && HOMEKIT_NAME.test(name))
const entry = v.object({
  name   : named,
  offLux : bounded(fields.offLux).optional(() => fields.offLux.placeholder),
  onLux  : bounded(fields.onLux).optional(() => fields.onLux.placeholder)
})
const identity = v.object({ name: named })

/**
 * Holds one entry under `thresholds`, the name of the sensor it registers and
 * the readings in lux at which that sensor switches on and off.
 */
export class ThresholdEntry {
  readonly name   : string
  readonly offLux : number
  readonly onLux  : number

  /**
   * Parses the entry at the zero-based `position` under `thresholds`, failing
   * a name that is missing, longer than `config.schema.json` allows, or outside
   * the rule HAP-NodeJS checks names against, a level outside the bounds the
   * schema declares, and two levels that leave no gap between them. A level
   * left out takes the placeholder the schema shows.
   */
  static parse(raw: unknown, position: number): ThresholdEntry | ThresholdFault {
    const parsed = entry.try(raw, { mode: 'strip' })

    if (parsed.ok) {
      const { name, offLux, onLux } = parsed.value

      return offLux === onLux
           ? new ThresholdFault(`${name} starts no sensor until its onLux and offLux differ`, name)
           : new ThresholdEntry(name, offLux, onLux)
    }

    const identified = identity.try(raw, { mode: 'strip' })
    const name       = identified.ok ? identified.value.name : undefined
    const label      = name ?? `Threshold ${position + 1}`

    return new ThresholdFault(
      `${label} starts no sensor until its settings hold a valid ${keysAtFault(parsed)}`,
      name
    )
  }

  private constructor(name: string, offLux: number, onLux: number) {
    this.name   = name
    this.offLux = offLux
    this.onLux  = onLux
  }

  /**
   * Names the input the sensor's UUID is generated from, which the sensor
   * also reports as its serial number.
   */
  get serial(): string {
    return serial(this.name)
  }

  /**
   * Decides whether the sensor detects at the reading `lux`, switching on where
   * `lux` reaches the on level, switching off where it passes the off level,
   * and keeping `detected` across the gap between the two. An on level below
   * the off level switches the sensor on as the light falls, and one above it
   * as the light rises.
   */
  detects(detected: boolean, lux: number): boolean {
    const sense = Math.sign(this.onLux - this.offLux)

    return sense * lux >= sense * this.onLux || detected && sense * lux >= sense * this.offLux
  }
}

/**
 * Names why an entry under `thresholds` starts no sensor, in the one line the
 * platform logs, beside the name the entry holds where that name parses.
 */
export class ThresholdFault {
  readonly line : string
  readonly name : string | undefined

  constructor(line: string, name?: string) {
    this.line = line
    this.name = name
  }

  /**
   * Names the input the UUID of the entry's sensor is generated from, or
   * `undefined` where the entry holds no name.
   */
  get serial(): string | undefined {
    return this.name === undefined ? undefined : serial(this.name)
  }
}

function serial(name: string): string {
  return `luxout-threshold-${name}`
}
