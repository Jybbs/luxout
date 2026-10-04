import * as v from '@badrap/valita'

import { Place } from '../config/place.js'

/**
 * The indices of the two steps an instant falls between.
 */
type Bracket = readonly [before: number, after: number]

type Steps = v.Infer<typeof BODY>['minutely_15']

const BODY = v.object({
  minutely_15: v.object({
    shortwave_radiation_instant : v.array(v.number()),
    time                        : v.array(v.number())
  })
    .assert(
      ({ shortwave_radiation_instant, time }) => shortwave_radiation_instant.length === time.length,
      'the step times and the irradiances differ in length'
    )
    .assert(
      ({ time }) => time.every((seconds, index, [first]) => seconds - index * STEP === first),
      'the steps sit other than 900 seconds apart'
    )
})
const PLACE = v.object({ latitude: v.number(), longitude: v.number() })
  .map(({ latitude, longitude }) => new Place(latitude, longitude))
const STEP = 900  // The seconds between two `minutely_15` steps

/**
 * Holds the shortwave irradiance Open-Meteo forecasts at the ground for a
 * place, one value per 15-minute step.
 */
export class ForecastWindow {
  readonly irradiances : readonly number[]  // Watts per square meter, one per step
  readonly place       : Place
  readonly times       : readonly number[]  // Milliseconds since the Unix epoch, one per step

  /**
   * Parses a body Open-Meteo returned for `place`, ignoring every field beside
   * `minutely_15`.
   *
   * Returns:
   *   The window, or the issues valita finds in a body whose arrays are
   *   missing, differ in length, sit other than 900 seconds apart, or hold a
   *   value that is not a number.
   */
  static parse(body: unknown, place: Place): v.ValitaResult<ForecastWindow> {
    const parsed = BODY.try(body, { mode: 'strip' })

    return parsed.ok ? v.ok(new ForecastWindow(place, parsed.value.minutely_15)) : parsed
  }

  /**
   * Parses the shape `toJSON` gives a window, taking its place from the
   * coordinates stored beside the steps.
   */
  static restore(stored: unknown): v.ValitaResult<ForecastWindow> {
    const place = PLACE.try(stored, { mode: 'strip' })

    return place.ok ? ForecastWindow.parse(stored, place.value) : place
  }

  private constructor(place: Place, steps: Steps) {
    this.irradiances = steps.shortwave_radiation_instant
    this.place       = place
    this.times       = steps.time.map((seconds) => seconds * 1000)
  }

  /**
   * Finds the first two adjacent steps whose times hold `instant` between them,
   * either end included.
   *
   * Returns:
   *   The indices of the two steps, or `undefined` where no two steps hold
   *   `instant` between them.
   */
  bracket(instant: Date): Bracket | undefined {
    const time  = instant.getTime()
    const index = this.times.findIndex((step, i) => step <= time && time <= (this.times[i + 1] ?? -Infinity))

    return index < 0 ? undefined : [index, index + 1]
  }

  /**
   * Reports whether two steps hold `instant` between them.
   */
  covers(instant: Date): boolean {
    return this.bracket(instant) !== undefined
  }

  /**
   * Shapes the window as the body Open-Meteo returns, its step times in Unix
   * seconds, beside the coordinates of its place. `restore` reads the shape
   * back.
   */
  toJSON() {
    return {
      latitude    : this.place.latitude,
      longitude   : this.place.longitude,
      minutely_15 : {
        shortwave_radiation_instant : this.irradiances,
        time                        : this.times.map((time) => time / 1000)
      }
    }
  }
}
