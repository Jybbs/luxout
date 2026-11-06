import { Body, Equator, Horizon, Observer } from 'astronomy-engine'

import type { Place } from '../config/place.js'

/**
 * Computes the sun's altitude for an observer at sea level at the latitude and
 * longitude of a place.
 */
export class Sun {
  readonly #observer: Observer

  constructor({ latitude, longitude }: Pick<Place, 'latitude' | 'longitude'>) {
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
