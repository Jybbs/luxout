import { range } from 'd3-array'

import { Place }          from '../../../../src/config/place.ts'
import { ClearSky }       from '../../../../src/daylight/clear-sky.ts'
import { Estimator }      from '../../../../src/daylight/estimator.ts'
import { Sun }            from '../../../../src/daylight/sun.ts'
import { ForecastWindow } from '../../../../src/weather/window.ts'
import recording          from '../search/recording.json' with { type: 'json' }
import forecast           from './forecast.json' with { type: 'json' }
import { clampLux }       from './homekit.ts'

const MIDNIGHT                          = Date.UTC(2026, 9, 4, 4)  // October 4, 2026, in `timezone`
const MINUTE                            = 60_000                   // Milliseconds
const { latitude, longitude, timezone } = recording.results[0]!
const clockFormat                       = new Intl.DateTimeFormat('en-US', {
  hour      : '2-digit',
  hourCycle : 'h23',
  minute    : '2-digit',
  timeZone  : timezone
})
const dateFormat = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', timeZone: timezone })
/**
 * The place the sample day and the Location Search both use, holding the
 * coordinates of the recorded result as the plugin stores them.
 */
const place = new Place(latitude, longitude)

/**
 * Runs the plugin's estimate across one sample day at the place the Location
 * Search finds, under the clouds of a recorded forecast. The forecast covers
 * the morning, and the clear-sky curve stands alone outside it.
 */
export class SampleDay {
  static readonly MINUTES = 1440
  static readonly NOON    = 720
  readonly altitudes : readonly number[]  // The sun's altitude in degrees at each minute from midnight
  readonly date      : string
  readonly readings  : readonly number[]  // The clamped lux at each minute from midnight
  readonly sky       : ClearSky

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
    const estimator = new Estimator(sky, new Sun(place))
    const factor    = estimator.derive(window)
    const estimates = range(SampleDay.MINUTES + 1).map((minute) =>
      estimator.estimate(instant(minute), factor)
    )

    this.altitudes = estimates.map(({ altitude }) => altitude)
    this.date      = dateFormat.format(instant(0))
    this.readings  = estimates.map(({ lux }) => clampLux(lux))
    this.sky       = sky
  }

  /**
   * Writes `minute` past midnight as a 24-hour clock time.
   */
  clock(minute: number): string {
    return clockFormat.format(instant(minute))
  }
}

function instant(minute: number): Date {
  return new Date(MIDNIGHT + minute * MINUTE)
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
