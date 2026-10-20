import * as v from '@badrap/valita'

import type { Place }     from '../config/place.js'
import { FetchFailure }   from './failure.js'
import { ForecastWindow } from './window.js'

type Tuning = typeof TUNING

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast'
const TUNING   = {
  forecast : 24,     // The 15-minute steps a request covers from the current one on
  past     : 4,      // The 15-minute steps a request covers before the current one
  timeout  : 10_000  // The milliseconds a request runs before it times out
}
const errorBody = v.object({ reason: v.string() })

/**
 * Sends requests to one of Open-Meteo's APIs with no API key, each bounded by a
 * timeout, returning every failure as a `FetchFailure` rather than throwing it.
 */
export abstract class OpenMeteoClient {
  readonly #endpoint : string
  readonly #fetch    : typeof fetch
  readonly #timeout  : number

  constructor(endpoint: string, fetch: typeof globalThis.fetch, timeout: number) {
    this.#endpoint = endpoint
    this.#fetch    = fetch
    this.#timeout  = timeout
  }

  /**
   * Requests the endpoint with `query` within the timeout, resolving to what
   * `parse` reads off the body or to the failure that kept it from arriving.
   */
  protected async request<T>(
    parse  : (body: unknown) => v.ValitaResult<T>,
    query  : Record<string, string>,
    signal : AbortSignal = new AbortController().signal
  ): Promise<FetchFailure | T> {
    try {
      const response = await this.#fetch(`${this.#endpoint}?${new URLSearchParams(query).toString()}`, {
        signal: AbortSignal.any([AbortSignal.timeout(this.#timeout), signal])
      })

      if (!response.ok) {
        const error  = errorBody.try(await response.json().catch(() => undefined), { mode: 'strip' })
        const status = `status ${response.status}`

        return new FetchFailure('status', error.ok ? `${status}, ${error.value.reason}` : status)
      }

      const parsed = parse(await response.json())

      return parsed.ok ? parsed.value : new FetchFailure('body', parsed.message)
    } catch (error) {
      return FetchFailure.from(error)
    }
  }
}

/**
 * Requests Open-Meteo's forecast of the shortwave irradiance at the ground, one
 * value per 15-minute step.
 */
export class ForecastClient extends OpenMeteoClient {
  readonly #tuning: Tuning

  constructor(fetch: typeof globalThis.fetch = globalThis.fetch, tuning: Tuning = TUNING) {
    super(ENDPOINT, fetch, tuning.timeout)
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
    const query = {
      forecast_minutely_15 : String(this.#tuning.forecast),
      latitude             : String(place.latitude),
      longitude            : String(place.longitude),
      minutely_15          : 'shortwave_radiation_instant',
      past_minutely_15     : String(this.#tuning.past),
      timeformat           : 'unixtime'
    }
    const outcome = await this.request((body) => ForecastWindow.parse(body, place), query, signal)

    return signal.aborted ? undefined : outcome
  }
}
