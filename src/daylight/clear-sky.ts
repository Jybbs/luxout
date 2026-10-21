import { DEG2RAD } from 'astronomy-engine'

const CIVIL_TWILIGHT = -6         // Circular 171's altitude in degrees at the lower limit of civil twilight
const EXTINCTION     = 0.21       // Circular 171's extinction coefficient of the direct rays per air mass
const RADIUS         = 753.66156  // Circular 171's Earth radius over the homogeneous atmosphere's height
const SKYLIGHT       = 0.0289     // Circular 171's coefficient of the empirical skylight term
const SKY_EXTINCTION = 0.042      // Circular 171's extinction coefficient of the skylight term per air mass
const SUNLIGHT       = 133775     // Circular 171's sun illuminance at the top of the atmosphere, in lux
const UNREFRACTED    = -5 / 6     // Circular 171's altitude in degrees below which no refraction is added

/**
 * Evaluates the sun illuminance model of U.S. Naval Observatory Circular 171
 * under its sky condition 1, an average clear sky, bridging the step its
 * refraction makes at -5/6 degrees. The model gives the light of the sun and
 * the sky together on a horizontal surface at sea level.
 */
export class ClearSky {
  readonly #high = this.#circular(UNREFRACTED)
  readonly #low  = this.#circular(CIVIL_TWILIGHT)

  /**
   * Computes the unclamped illuminance in lux for the sun at the geometric
   * `altitude` in degrees.
   *
   * From -6 degrees, the lower limit of civil twilight, up to -5/6 degrees, the
   * logarithm of the illuminance runs linearly in altitude between the
   * circular's values at those two altitudes, so the curve climbs through -5/6
   * degrees without the step the circular's refraction makes there.
   */
  illuminance(altitude: number): number {
    if (altitude <= CIVIL_TWILIGHT || altitude >= UNREFRACTED) return this.#circular(altitude)

    const fraction = (altitude - CIVIL_TWILIGHT) / (UNREFRACTED - CIVIL_TWILIGHT)

    return this.#low * (this.#high / this.#low) ** fraction
  }

  /**
   * Adds the circular's refraction, its modification of Bennett's formula, to
   * the sun's geometric `altitude` in degrees. Below -5/6 degrees it adds none,
   * so the result steps by about 0.61 degrees there.
   */
  refracted(altitude: number): number {
    return altitude < UNREFRACTED
         ? altitude
         : altitude + 1 / Math.tan((altitude + 8.6 / (altitude + 4.42)) * DEG2RAD) / 60
  }

  /**
   * Computes the circular's illuminance in lux for the sun at the geometric
   * `altitude` in degrees, attenuated through the air mass at the refracted
   * altitude.
   */
  #circular(altitude: number): number {
    const apparent = this.refracted(altitude) * DEG2RAD
    const sine     = Math.sin(apparent)
    const mass     = Math.sqrt((RADIUS + 1) ** 2 - (RADIUS * Math.cos(apparent)) ** 2) - RADIUS * sine
    const direct   = Math.exp(-EXTINCTION * mass) * sine
    const sky      = SKYLIGHT * Math.exp(-SKY_EXTINCTION * mass) * (1 + (apparent + Math.PI / 2) * sine)

    return SUNLIGHT * (direct + sky)
  }
}
