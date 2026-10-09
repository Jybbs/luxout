import { expect, it } from 'vitest'

import { Sun } from '../../src/daylight/sun.js'

/**
 * The topocentric elevation angle (uncorrected) that the National Laboratory of
 * the Rockies' Solar Position Algorithm calculator computes at each place and
 * instant, under an elevation of 0 meters, a ΔUT1 of 0 seconds, and a ΔT of 69
 * seconds.
 */
const SPA = [
  { altitude:  85.358169, latitude:  -0.22985, longitude:  -78.52495, time: '2026-03-20T17:40:00Z' },
  { altitude:  75.041928, latitude: -33.86785, longitude:  151.20732, time: '2026-01-15T02:40:00Z' },
  { altitude:  59.764293, latitude:  42.35843, longitude:  -71.05977, time: '2026-06-21T18:40:00Z' },
  { altitude:  45.173800, latitude: -54.81084, longitude:  -68.31591, time: '2026-01-15T19:20:00Z' },
  { altitude:  30.013067, latitude:  69.6489,  longitude:   18.95508, time: '2026-06-21T06:20:00Z' },
  { altitude:  10.006121, latitude:  -0.22985, longitude:  -78.52495, time: '2026-06-21T12:00:00Z' },
  { altitude:   3.049170, latitude:  70,       longitude:  180,       time: '2026-03-20T05:30:00Z' },
  { altitude:  -0.866851, latitude: -33.86785, longitude:  151.20732, time: '2026-06-21T21:00:00Z' },
  { altitude:  -2.989077, latitude:  42.35843, longitude:  -71.05977, time: '2026-09-22T10:20:00Z' },
  { altitude:  -6.121540, latitude: -54.81084, longitude:  -68.31591, time: '2026-12-21T02:10:00Z' },
  { altitude:  -8.954229, latitude:  69.6489,  longitude:   18.95508, time: '2026-01-15T07:10:00Z' },
  { altitude: -12.080925, latitude:  -0.22985, longitude:  -78.52495, time: '2026-03-20T00:10:00Z' },
  { altitude: -14.893741, latitude:  70,       longitude:  180,       time: '2026-01-15T05:10:00Z' },
  { altitude: -18.027789, latitude: -33.86785, longitude:  151.20732, time: '2026-12-21T10:50:00Z' },
  { altitude: -24.042758, latitude:  42.35843, longitude:  -71.05977, time: '2026-12-21T23:30:00Z' },
  { altitude: -44.998453, latitude: -54.81084, longitude:  -68.31591, time: '2026-06-21T07:30:00Z' }
]

it.each(SPA)(
  'holds the altitude at $latitude, $longitude on $time within 0.001° of SPA',
  ({ altitude, latitude, longitude, time }) => {
    expect(Math.abs(new Sun(latitude, longitude).altitude(new Date(time)) - altitude)).toBeLessThan(0.001)
  }
)
