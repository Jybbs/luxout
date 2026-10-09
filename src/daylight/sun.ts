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
   * Computes the geometric altitude of the sun's center at `time`, in degrees
   * and before any refraction, negative below the horizon.
   */
  altitude(time: Date): number {
    const { dec, ra } = Equator(Body.Sun, time, this.#observer, true, true)

    return Horizon(time, this.#observer, ra, dec).altitude
  }
}
