import { fc, test }   from '@fast-check/vitest'
import { expect, it } from 'vitest'

import { Place } from '../../src/config/place.js'

const latitudes  = fc.double({ max: 90, min: -90, noNaN: true })
const longitudes = fc.double({ max: 180, min: -180, noNaN: true })

it.each([
  { latitude: 42.35843, longitude: -71.05977, rounded: { latitude: 42.36, longitude: -71.06 } },
  { latitude: -33.8688, longitude: 151.2093,  rounded: { latitude: -33.87, longitude: 151.21 } },
  { latitude: 0.004,    longitude: -0.006,    rounded: { latitude: 0, longitude: -0.01 } }
])('rounds $latitude and $longitude to two decimals', ({ latitude, longitude, rounded }) => {
  expect(new Place(latitude, longitude)).toEqual(rounded)
})

test.prop([latitudes, longitudes])('rounds a rounded place to the same place', (latitude, longitude) => {
  const place = new Place(latitude, longitude)

  expect(new Place(place.latitude, place.longitude).equals(place)).toBe(true)
})

it.each([
  { other: new Place(42.37, -71.06), what: 'latitude' },
  { other: new Place(42.36, -71.07), what: 'longitude' }
])('differs from a place whose rounded $what differs', ({ other }) => {
  expect(new Place(42.35843, -71.05977).equals(other)).toBe(false)
})

it('equals a place whose coordinates differ only past two decimals', () => {
  expect(new Place(42.35843, -71.05977).equals(new Place(42.3649, -71.0551))).toBe(true)
})
