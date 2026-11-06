import type { ForecastWindow }             from '../weather/window.js'
import type { ClearSky }                   from './clear-sky.js'
import { CloudFactor, type Interpolation } from './cloud-factor.js'
import type { Sun }                        from './sun.js'

/**
 * Holds the estimate of the outdoor illuminance at an instant beside the values
 * it is built from. Where no window covers the instant, the cloud factor is 1
 * and the steps it was interpolated between are `undefined`.
 */
class Estimate {
  readonly altitude : number  // The sun's geometric altitude in degrees
  readonly clearSky : number  // The clear-sky illuminance at that altitude, in lux
  readonly factor   : number
  readonly steps    : Interpolation['steps'] | undefined

  constructor(altitude: number, clearSky: number, interpolation?: Interpolation) {
    this.altitude = altitude
    this.clearSky = clearSky
    this.factor   = interpolation?.factor ?? 1
    this.steps    = interpolation?.steps
  }

  /**
   * Scales the clear-sky illuminance by the cloud factor, in lux and before any
   * clamp.
   */
  get lux(): number {
    return this.clearSky * this.factor
  }
}

/**
 * Estimates the outdoor illuminance from the sun's altitude and the cloud
 * factor of a forecast window.
 */
export class Estimator {
  readonly #sky : ClearSky
  readonly #sun : Sun

  constructor(sky: ClearSky, sun: Sun) {
    this.#sky = sky
    this.#sun = sun
  }

  /**
   * Derives the cloud factor of `window` under the sun and the clear sky the
   * estimator reads, carrying daylight steps over from `earlier` as
   * `CloudFactor` does.
   */
  derive(window: ForecastWindow, earlier?: CloudFactor): CloudFactor {
    return new CloudFactor(this.#sky, this.#sun, window, earlier)
  }

  /**
   * Estimates the illuminance at `instant` from the sun's altitude and from the
   * cloud factor that `factor` interpolates there.
   */
  estimate(instant: Date, factor?: CloudFactor): Estimate {
    const altitude = this.#sun.altitude(instant)

    return new Estimate(altitude, this.#sky.illuminance(altitude), factor?.at(instant))
  }
}
