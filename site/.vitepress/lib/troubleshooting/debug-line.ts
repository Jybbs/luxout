import { format } from 'node:util'

import * as hap                                 from '@homebridge/hap-nodejs'
import type { API, Logging, PlatformAccessory } from 'homebridge'

import schema                     from '../../../../config.schema.json' with { type: 'json' }
import { Estimator }              from '../../../../src/daylight/estimator.ts'
import type { CloudFactor }       from '../../../../src/daylight/cloud-factor.ts'
import { figure }                 from '../../../../src/sensor/figure.ts'
import { OUTSIDE, OutsideSensor } from '../../../../src/sensor/outside.ts'
import { Reading }                from '../../../../src/sensor/reading.ts'
import { STEP_MINUTES }           from '../daylight/clock.ts'
import { luxRange }               from '../daylight/homekit.ts'
import { SampleDay, instant }     from '../daylight/sample-day.ts'
import recording                  from '../search/recording.json' with { type: 'json' }

export type FieldKey = (typeof FIELDS)[number]['key']

/**
 * The fields of the debug line in the order the line prints them, each with
 * the word its tile is labeled by and the hue its quantity is drawn in, the
 * parameters of the logged message filling the fields from `reading` on.
 */
const FIELDS = [
  { hue: 'plain', key: 'stamp', name: 'Time' },
  { hue: 'plain', key: 'prefix', name: 'Name' },
  { hue: 'plain', key: 'sensor', name: 'Sensor' },
  { hue: 'estimate', key: 'reading', name: 'Reading' },
  { hue: 'geometry', key: 'altitude', name: 'Altitude' },
  { hue: 'sky', key: 'clear', name: 'Clear sky' },
  { hue: 'forecast', key: 'factor', name: 'Cloud factor' },
  { hue: 'forecast', key: 'steps', name: 'Forecast steps' }
] as const
const NOTES = {
  altitude : 'The sun’s angle above the horizon, before refraction.',
  clear    : 'The lux of a cloudless sky at this altitude, per U.S. Naval Observatory Circular 171.',
  factor   : 'The forecast’s share of clear-sky sunlight at the ground.',
  prefix   : 'The platform block’s name, or the platform name the plugin registers where it sets none.',
  reading  : `The lux Apple Home shows, held between ${figure.format(luxRange.min)} and `
           + `${figure.format(luxRange.max)}.`,
  sensor   : 'The light sensor the reading is for, as the plugin names it.',
  stamp    : 'The time on the bridge’s clock, in its locale’s format.',
  steps    : `The two ${STEP_MINUTES}-minute steps the factor falls between, each at its time in UTC.`
} satisfies Record<FieldKey, string>
const UNITS: Partial<Record<FieldKey, string>> = { altitude: '°', clear: ' lux', reading: ' lux' }

/**
 * One field of the debug line, with the value its tile shows and the note its
 * tile opens.
 */
export interface DebugField {
  readonly hue   : (typeof FIELDS)[number]['hue']
  readonly key   : FieldKey
  readonly name  : string
  readonly note  : string
  readonly value : string
}

/**
 * The debug line the plugin logs for one minute of the sample day, as the
 * Homebridge log prints it and field by field.
 */
export interface DebugLine {
  readonly fields : readonly DebugField[]
  readonly line   : string
}

/**
 * Reads the sample day at one fixed minute, whichever instant the reading asks
 * for.
 */
class SampleEstimator extends Estimator {
  readonly #minute : number

  constructor(day: SampleDay, minute: number) {
    super(day.sky, day.sun)
    this.#minute = minute
  }

  override estimate(_: Date, factor?: CloudFactor): ReturnType<Estimator['estimate']> {
    return super.estimate(instant(this.#minute), factor)
  }
}

/**
 * Runs the plugin's reading over the sample day's window at the sample day's
 * resting minute and splits the line it logs at debug level into its fields.
 */
export function debugLine(day: SampleDay): DebugLine {
  const logged: unknown[][] = []
  const log                 = Object.assign(() => undefined, {
    debug   : (...line: unknown[]) => logged.push(line),
    error   : () => undefined,
    info    : () => undefined,
    log     : () => undefined,
    prefix  : schema.pluginAlias,
    success : () => undefined,
    warn    : () => undefined
  }) as unknown as Logging
  const accessory = new hap.Accessory(OUTSIDE.name, hap.uuid.generate(OUTSIDE.serial))
  const sensor    = new OutsideSensor(accessory as unknown as PlatformAccessory, { hap } as unknown as API)
  const reading   = new Reading(new SampleEstimator(day, SampleDay.REST), log, sensor)
  const stopped   = new AbortController()

  reading.use(day.window)
  reading.start(stopped.signal)
  stopped.abort()

  const [message, ...parameters] = logged[0] as [string, ...string[]]

  const stamp  = instant(SampleDay.REST).toLocaleString('en-US', { timeZone: recording.results[0]!.timezone })
  const steps  = parameters.slice(4)
  const values = [
    stamp,
    log.prefix,
    OUTSIDE.name,
    ...parameters.slice(0, 4),
    `${steps[0]} at ${steps[1]} and ${steps[2]} at ${steps[3]}`
  ]

  return {
    fields: FIELDS.map(({ hue, key, name }, index) => ({
      hue,
      key,
      name,
      note  : NOTES[key],
      value : `${values[index]}${UNITS[key] ?? ''}`
    })),
    line: `[${stamp}] [${log.prefix}] ${format(message, ...parameters)}`
  }
}
