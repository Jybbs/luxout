import type { Place } from '../../config/place.js'

export type Coordinates = Pick<Place, 'latitude' | 'longitude'>

/**
 * Holds one place a location search matched, with the name, the first-level
 * region, and the country the user confirms it by.
 */
export class Match {
  readonly country : string | undefined
  readonly name    : string
  readonly place   : Coordinates
  readonly region  : string | undefined

  constructor(name: string, place: Coordinates, country?: string, region?: string) {
    this.country = country
    this.name    = name
    this.place   = place
    this.region  = region
  }

  /**
   * Joins the name, the region, and the country the place carries, each apart
   * from the next by a comma.
   */
  get label(): string {
    return [this.name, this.region, this.country].filter(Boolean).join(', ')
  }
}
