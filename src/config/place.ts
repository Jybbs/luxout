/**
 * Holds the location a forecast is fetched for, its latitude and longitude in
 * degrees rounded to two decimals, which resolve a place to about a kilometer.
 */
export class Place {
  readonly latitude  : number
  readonly longitude : number

  constructor(latitude: number, longitude: number) {
    this.latitude  = round(latitude)
    this.longitude = round(longitude)
  }

  equals(other: Place): boolean {
    return this.latitude === other.latitude && this.longitude === other.longitude
  }
}

function round(degrees: number): number {
  return Number(degrees.toFixed(2))
}
