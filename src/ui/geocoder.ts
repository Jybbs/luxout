import * as v from '@badrap/valita'

import { Place }             from '../config/place.js'
import { OpenMeteoClient }   from '../weather/client.js'
import type { FetchFailure } from '../weather/failure.js'
import { Match }             from './match.js'

type Tuning = typeof TUNING

const ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search'
const TUNING   = {
  count   : 10,     // The most matches one search returns
  timeout : 10_000  // The milliseconds a request runs before it times out
}
const searchBody = v.object({
  results: v.array(
    v.object({
      admin1    : v.string().optional(),
      country   : v.string().optional(),
      latitude  : v.number(),
      longitude : v.number(),
      name      : v.string()
    })
      .map(({ admin1, country, latitude, longitude, name }) =>
        new Match(name, new Place(latitude, longitude), country, admin1)
      )
  )
    .optional(() => [])
})
  .map(({ results }) => results)

/**
 * Searches Open-Meteo's geocoding API for the places whose name or postal code
 * matches what the user typed.
 */
export class Geocoder extends OpenMeteoClient {
  readonly #tuning: Tuning

  constructor(fetch: typeof globalThis.fetch = globalThis.fetch, tuning: Tuning = TUNING) {
    super(ENDPOINT, fetch, tuning.timeout)
    this.#tuning = tuning
  }

  /**
   * Searches for the places matching `name` in every country, each named in the
   * language of `locale`, resolving to an empty list where the search finds
   * nothing.
   */
  async search(locale: Intl.Locale, name: string): Promise<FetchFailure | Match[]> {
    const query = { count: String(this.#tuning.count), language: locale.language, name }

    return this.request((body) => searchBody.try(body, { mode: 'strip' }), query)
  }
}
