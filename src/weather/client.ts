import * as v from '@badrap/valita'

import type { Place }     from '../config/place.js'
import { FetchFailure }   from './failure.js'
import { ForecastWindow } from './window.js'

type Tuning = typeof TUNING

const ENDPOINT  = 'https://api.open-meteo.com/v1/forecast'
const TUNING    = {
  forecast : 24,     // The 15-minute steps a request covers from the current one on
  past     : 4,      // The 15-minute steps a request covers before the current one
  timeout  : 10_000  // The milliseconds a request runs before it times out
}
const errorBody = v.object({ reason: v.string() })

/**
 * Requests Open-Meteo's forecast of the shortwave irradiance at the ground, one
 * value per 15-minute step, with no API key.
 */
export class ForecastClient {
  readonly #fetch  : typeof fetch
  readonly #tuning : Tuning

  constructor(fetch: typeof globalThis.fetch = globalThis.fetch, tuning: Tuning = TUNING) {
    this.#fetch  = fetch
    this.#tuning = tuning
  }

  /**
   * Fetches the window for `place` within the tuning's timeout, resolving to
   * the failure that kept it from arriving, or to `undefined` once `signal`
   * aborts.
   */
  async fetch(
    place  : Place,
    signal : AbortSignal = new AbortController().signal
  ): Promise<FetchFailure | ForecastWindow | undefined> {
    const outcome = await this.#request(place, signal).catch((error: unknown) => FetchFailure.from(error))

    return signal.aborted ? undefined : outcome
  }

  async #request(place: Place, signal: AbortSignal): Promise<FetchFailure | ForecastWindow> {
    const query = new URLSearchParams({
      forecast_minutely_15 : String(this.#tuning.forecast),
      latitude             : String(place.latitude),
      longitude            : String(place.longitude),
      minutely_15          : 'shortwave_radiation_instant',
      past_minutely_15     : String(this.#tuning.past),
      timeformat           : 'unixtime'
    })
    const response = await this.#fetch(`${ENDPOINT}?${query.toString()}`, {
      signal: AbortSignal.any([AbortSignal.timeout(this.#tuning.timeout), signal])
    })

    if (!response.ok) {
      const error  = errorBody.try(await response.json().catch(() => undefined), { mode: 'strip' })
      const status = `status ${response.status}`

      return new FetchFailure('status', error.ok ? `${status}, ${error.value.reason}` : status)
    }

    const window = ForecastWindow.parse(await response.json(), place)

    return window.ok ? window.value : new FetchFailure('body', window.message)
  }
}
