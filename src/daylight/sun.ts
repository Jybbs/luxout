import { Body, Equator, Horizon, Observer } from 'astronomy-engine'

/**
 * Computes the sun's altitude for an observer at sea level, at a latitude and
 * longitude in degrees.
 */
export class Sun {
  readonly #observer: Observer

  constructor(latitude: number, longitude: number) {
    this.#observer = new Observer(latitude, longitude, 0)
  }

  /**
   * Converts the sun's topocentric equatorial coordinates of date at `time`
   * into its geometric altitude, before any refraction.
   *
   * Returns:
   *   The altitude of the sun's center in degrees, negative below the horizon.
   */
  altitude(time: Date): number {
    const { dec, ra } = Equator(Body.Sun, time, this.#observer, true, true)

    return Horizon(time, this.#observer, ra, dec).altitude
  }
}
