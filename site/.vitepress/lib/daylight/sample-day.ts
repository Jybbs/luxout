import { Body, Equator, Horizon, Observer } from 'astronomy-engine'
import { range }                            from 'd3-array'

import { Place }          from '../../../../src/config/place.ts'
import { ClearSky }       from '../../../../src/daylight/clear-sky.ts'
import { CLOUD_TUNING, type CloudFactor, type Interpolation } from '../../../../src/daylight/cloud-factor.ts'
import { Estimator }      from '../../../../src/daylight/estimator.ts'
import { Sun }            from '../../../../src/daylight/sun.ts'
import { ForecastWindow } from '../../../../src/weather/window.ts'
import recording          from '../search/recording.json' with { type: 'json' }
import * as clock         from './clock.ts'
import forecast           from './forecast.json' with { type: 'json' }
import { clampLux }       from './homekit.ts'

const MIDNIGHT                          = Date.UTC(2026, 9, 4, 4)  // October 4, 2026, in `timezone`
const { latitude, longitude, timezone } = recording.results[0]!
const clockFormat                       = clock.clockFormatIn(timezone)
const dateFormat                        = clock.dateFormatIn(timezone)
/**
 * The place the sample day and the Location Search both use, holding the
 * coordinates of the recorded result as the plugin stores them.
 */
const place    = new Place(latitude, longitude)
const observer = new Observer(latitude, longitude, 0)

/**
 * Runs the plugin's estimate across one sample day at the place the Location
 * Search finds, under the clouds of a recorded forecast. The forecast covers
 * the morning, and the clear-sky curve stands alone outside it.
 */
export class SampleDay {
  static readonly MINUTES = clock.DAY_MINUTES
  static readonly NOON    = 720
  static readonly REST    = 600  // 10:00, in minutes from midnight
  readonly altitudes  : readonly number[]  // The sun's altitude in degrees at each minute from midnight
  readonly clearSkies : readonly number[]  // The unclamped clear-sky lux at each minute from midnight
  readonly cloud      : CloudFactor
  readonly date       : string
  readonly factors    : readonly number[]  // The cloud factor at each minute from midnight
  readonly readings   : readonly number[]  // The clamped lux at each minute from midnight
  readonly sky        : ClearSky
  readonly steps      : readonly (Interpolation['steps'] | undefined)[]  // The steps around each minute
  readonly sun        : Sun
  readonly window     : ForecastWindow

  /**
   * Builds the day from the recorded forecast, failing where it no longer
   * parses.
   */
  static record(): SampleDay {
    const parsed = ForecastWindow.parse(forecast, place)

    if (!parsed.ok) throw new Error(parsed.message)

    return new SampleDay(parsed.value)
  }

  private constructor(window: ForecastWindow) {
    const sky       = new ClearSky()
    const sun       = new Sun(place)
    const estimator = new Estimator(sky, sun)
    const factor    = estimator.derive(window)
    const estimates = range(SampleDay.MINUTES + 1).map((minute) =>
      estimator.estimate(instant(minute), factor)
    )

    this.altitudes  = estimates.map(({ altitude }) => altitude)
    this.clearSkies = estimates.map(({ clearSky }) => clearSky)
    this.cloud      = factor
    this.date       = dateFormat.format(instant(0))
    this.factors    = estimates.map(({ factor }) => factor)
    this.readings   = estimates.map(({ lux }) => clampLux(lux))
    this.sky        = sky
    this.steps      = estimates.map(({ steps }) => steps)
    this.sun        = sun
    this.window     = window
  }

  /**
   * The minutes past midnight of the window's first and last steps.
   */
  get span(): readonly [from: number, to: number] {
    const { times } = this.window

    return [this.minuteOf(times[0]!), this.minuteOf(times.at(-1)!)]
  }

  /**
   * Finds the sun's azimuth in degrees clockwise from north at `minute` past
   * midnight, before any refraction.
   */
  azimuth(minute: number): number {
    const time        = instant(minute)
    const { dec, ra } = Equator(Body.Sun, time, observer, true, true)

    return Horizon(time, observer, ra, dec).azimuth
  }

  /**
   * Writes `minute` past midnight as a 24-hour clock time.
   */
  clock(minute: number): string {
    return clockFormat.format(instant(minute))
  }

  /**
   * Writes `time`, in milliseconds since the Unix epoch, as a 24-hour clock
   * time.
   */
  clockAt(time: number): string {
    return this.clock(this.minuteOf(time))
  }

  /**
   * Tests whether the sun at `time`, in milliseconds since the Unix epoch,
   * stands at or above the floor under which a step borrows its factor.
   */
  litAt(time: number): boolean {
    return this.refractedAt(time) >= CLOUD_TUNING.floor
  }

  /**
   * Finds the minutes past midnight of `time`, in milliseconds since the Unix
   * epoch.
   */
  minuteOf(time: number): number {
    return (time - MIDNIGHT) / clock.MINUTE
  }

  /**
   * Finds the sun's refracted altitude in degrees at `time`, in milliseconds
   * since the Unix epoch.
   */
  refractedAt(time: number): number {
    return this.sky.refracted(this.sun.altitude(new Date(time)))
  }
}

/**
 * Finds the first index in `altitudes` at or above `level` and the first index
 * after it back below `level`.
 */
export function crossings(altitudes: readonly number[], level: number): readonly [number, number] {
  return runsOf(altitudes.map((altitude) => altitude >= level))[0]!
}

/**
 * Finds the instant `minute` past the sample day's midnight.
 */
export function instant(minute: number): Date {
  return new Date(MIDNIGHT + minute * clock.MINUTE)
}

/**
 * Finds each unbroken run of `true` in `flags`, each end one past its last
 * flag.
 */
export function runsOf(flags: readonly boolean[]): (readonly [start: number, end: number])[] {
  const edges = flags.keys()
    .filter((index) => flags[index] !== (flags[index - 1] ?? false))
    .toArray()

  return range(0, edges.length, 2).map((index) => [edges[index]!, edges[index + 1] ?? flags.length] as const)
}
