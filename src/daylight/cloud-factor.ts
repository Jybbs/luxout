import { DEG2RAD } from 'astronomy-engine'

import type { ForecastWindow } from '../weather/window.js'
import type { ClearSky }       from './clear-sky.js'
import type { Sun }            from './sun.js'

/**
 * The cloud factor at an instant between two steps, beside those two steps.
 */
export interface Interpolation {
  factor : number
  steps  : readonly [StepFactor, StepFactor]
}

/**
 * The cloud factor a step of the forecast takes, beside the step's time in
 * milliseconds since the Unix epoch.
 */
interface StepFactor {
  factor : number
  time   : number
}

type Tuning = typeof TUNING

const HAURWITZ_ATTENUATION = 0.057  // The attenuation coefficient of equation 18 in SAND2012-2389
const HAURWITZ_PEAK        = 1098   // The irradiance that equation scales by cos z, in watts per square meter
const TUNING               = {
  ahead   : 14_400_000,  // Four hours in milliseconds, the span after a step below the floor
  behind  : 43_200_000,  // Twelve hours in milliseconds, the span before it
  floor   : 5,           // The refracted altitude in degrees below which the ratio carries no signal
  nearest : 4            // The count of daylight steps whose mean factor a step below the floor takes
}

/**
 * Derives the cloud factor at each step of a forecast window, as the ratio of
 * the forecast irradiance to the clear-sky irradiance of the Haurwitz model,
 * clamped between 0 and 1. The model takes the constants of equation 18 in
 * Sandia report SAND2012-2389 and runs at the refracted altitude `ClearSky`
 * applies.
 *
 * A step whose refracted altitude sits below the floor takes the mean factor of
 * the daylight steps closest to it, as many as the tuning's `nearest`, from
 * `behind` before it to `ahead` after it, and 1 where none lies in that span.
 * Each daylight step comes from this window, or from `earlier` where it
 * precedes this window's first step.
 */
export class CloudFactor {
  readonly #daylight : readonly StepFactor[]
  readonly #steps    : readonly StepFactor[]
  readonly #window   : ForecastWindow

  constructor(
    sky      : ClearSky,
    sun      : Sun,
    window   : ForecastWindow,
    earlier? : CloudFactor,
    tuning   : Tuning = TUNING
  ) {
    const first    = window.times[0] ?? Infinity
    const carried  = earlier === undefined ? [] : earlier.#daylight
    const daylight = window.times.flatMap((time, index) => {
      const altitude = sky.refracted(sun.altitude(new Date(time)))
      const share    = (window.irradiances[index] ?? 0) / haurwitz(altitude)

      return altitude < tuning.floor ? [] : [{ factor: Math.min(Math.max(share, 0), 1), time }]
    })

    this.#window   = window
    this.#daylight = [
      ...carried.filter(({ time }) => time < first && time >= first - tuning.behind),
      ...daylight
    ]
    this.#steps = window.times.map((time) => daylight.find((step) => step.time === time)
                                          ?? { factor: nearest(this.#daylight, time, tuning), time })
  }

  /**
   * Interpolates the cloud factor linearly between the two steps on either side
   * of `instant`.
   *
   * Returns:
   *   The interpolation, or `undefined` where the window does not cover
   *   `instant`.
   */
  at(instant: Date): Interpolation | undefined {
    const [before, after] = this.#window.bracket(instant)?.map((index) => this.#steps[index]) ?? []

    if (before === undefined || after === undefined) return undefined

    const fraction = (instant.getTime() - before.time) / (after.time - before.time)

    return { factor: before.factor + (after.factor - before.factor) * fraction, steps: [before, after] }
  }
}

/**
 * Computes the clear-sky irradiance of the Haurwitz model in watts per square
 * meter, for the sun at the refracted `altitude` in degrees.
 */
function haurwitz(altitude: number): number {
  const cosine = Math.sin(altitude * DEG2RAD)

  return HAURWITZ_PEAK * cosine * Math.exp(-HAURWITZ_ATTENUATION / cosine)
}

/**
 * Takes the mean factor of the daylight steps nearest `time` within the span
 * the tuning sets around it, or 1 where none lies in that span.
 */
function nearest(daylight: readonly StepFactor[], time: number, tuning: Tuning): number {
  const offset = (step: StepFactor): number => step.time - time
  const near   = daylight.filter((step) => offset(step) >= -tuning.behind && offset(step) <= tuning.ahead)
    .toSorted((one, other) => Math.abs(offset(one)) - Math.abs(offset(other)))
    .slice(0, tuning.nearest)

  return near.length === 0 ? 1 : near.reduce((sum, step) => sum + step.factor, 0) / near.length
}
