import * as v           from '@badrap/valita'
import { RequestError } from '@homebridge/plugin-ui-utils'

import schema           from '../../config.schema.json' with { type: 'json' }
import type { Place }   from '../config/place.js'
import { Settings }     from '../config/settings.js'
import { FetchFailure } from '../weather/failure.js'
import { Geocoder }     from './geocoder.js'
import type { Match }   from './public/match.js'

const { latitude, longitude } = schema.schema.properties
const searchRequest           = v.object({ language: v.string().chain(locale), query: v.string() })
const bounds                  = `Coordinates take a latitude from ${latitude.minimum} to ${latitude.maximum} `
                              + `and a longitude from ${longitude.minimum} to ${longitude.maximum}`

/**
 * Answers the settings page's requests, the search for a place and the check of
 * the coordinates the user typed or confirmed, throwing each failure as a
 * `RequestError` whose message the page shows.
 */
export class LocationService {
  readonly #geocoder: Geocoder

  constructor(geocoder: Geocoder = new Geocoder()) {
    this.#geocoder = geocoder
  }

  /**
   * Validates the coordinates `payload` holds as the platform validates its
   * block, returning the place they round to.
   */
  check(payload: unknown): Place {
    const settings = Settings.parse(payload)

    if (!settings.ok) throw new RequestError(bounds, settings.issues)

    return settings.value.place
  }

  /**
   * Searches for the places matching the query `payload` holds, named in the
   * language the Homebridge UI runs in, and fails a search that matches nothing
   * with a hint to search by the city's name.
   */
  async search(payload: unknown): Promise<Match[]> {
    const request = searchRequest.try(payload, { mode: 'strip' })

    if (!request.ok) throw new RequestError(request.message, request.issues)

    const { language, query } = request.value
    const matches             = await this.#geocoder.search(language, query)

    if (matches instanceof FetchFailure) throw new RequestError(matches.line, matches)
    if (matches.length === 0) {
      throw new RequestError(
        `No place matches “${query}”, so search by the city’s name instead`,
        { query }
      )
    }

    return matches
  }
}

function locale(tag: string): v.ValitaResult<Intl.Locale> {
  try {
    return v.ok(new Intl.Locale(tag))
  } catch {
    return v.err('not a language tag')
  }
}
