import { Place } from '../../src/config/place.js'

/**
 * Holds the public places the suites estimate for and the fixtures were fetched
 * for, each at the coordinates Open-Meteo's geocoding API returns for a search
 * of Los Angeles, Boston, and New Delhi in turn.
 */
export const angeles = new Place(34.05223, -118.24368)
export const boston  = new Place(42.35843, -71.05977)
export const delhi   = new Place(28.62137, 77.2148)
