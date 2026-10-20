import type { Place } from '../config/place.js'

/**
 * Holds one place a location search matched, with the name, the first-level
 * region, and the country the user confirms it by.
 */
export class Match {
  readonly country : string | undefined
  readonly name    : string
  readonly place   : Place
  readonly region  : string | undefined

  constructor(name: string, place: Place, country?: string, region?: string) {
    this.country = country
    this.name    = name
    this.place   = place
    this.region  = region
  }
}
