import { fc, test }   from '@fast-check/vitest'
import { expect, it } from 'vitest'

import { ClearSky } from '../../src/daylight/clear-sky.js'
import { Sun }      from '../../src/daylight/sun.js'
import { boston }   from '../common/places.js'

/**
 * The sun illuminance that U.S. Naval Observatory Circular 171 prints under sky
 * condition 1 for Figure 3's sample run and for cases III and VII of Table A,
 * its Test Cases for Program Certification. Case VII gives 18:31 local mean
 * time, which is 15:53 UT at longitude 39.5.
 */
const CIRCULAR = [
  { latitude:  58.0, longitude:   -4.0, lux:      0.0278, run: 'Figure 3', time: '1987-05-11T22:15:00Z' },
  { latitude: -23.4, longitude: -135.8, lux: 123786,      run: 'case III', time: '1986-12-18T21:00:00Z' },
  { latitude:  21.3, longitude:   39.5, lux:    697,      run: 'case VII', time: '1988-08-13T15:53:00Z' }
]

// Draws half its altitudes from -6° to -5/6°, where the curve bridges the step at the refraction cutoff
const climbing = fc.oneof(
  fc.double({ max: -5 / 6, min: -6, noNaN: true }),
  fc.double({ max: 90, min: -6, noNaN: true })
)
const rising = fc.double({ max: 96, min: 0.01, noNaN: true })
const sky    = new ClearSky()

it.each(CIRCULAR)(
  'reaches the $lux lux of $run within 0.05° of the altitude the Sun computes',
  ({ latitude, longitude, lux, time }) => {
    const altitude = new Sun({ latitude, longitude }).altitude(new Date(time))

    expect(lux).toBeGreaterThan(sky.illuminance(altitude - 0.05))
    expect(lux).toBeLessThan(sky.illuminance(altitude + 0.05))
  }
)

it.each([
  { altitude: 0,  apparent: 0.490601 },
  { altitude: 10, apparent: 10.089089 },
  { altitude: 45, apparent: 45.016566 },
  { altitude: 90, apparent: 89.999974 }
])('refracts the sun at $altitude° to $apparent°', ({ altitude, apparent }) => {
  expect(sky.refracted(altitude)).toBeCloseTo(apparent, 5)
})

it('keeps the step of about 0.61° the refraction makes at -5/6°', () => {
  expect(sky.refracted(-5 / 6) - sky.refracted(-5 / 6 - 1e-9)).toBeCloseTo(0.61, 2)
})

it.each([
  { altitude: -6,     edge: 'at -6°, the lower limit of civil twilight', lux: 2.99 },
  { altitude: -5 / 6, edge: 'at -5/6°, the refraction cutoff',          lux: 662 }
])('meets the circular’s $lux lux without a step $edge', ({ altitude, lux }) => {
  expect(sky.illuminance(altitude) / lux).toBeCloseTo(1, 2)
  expect(sky.illuminance(altitude - 1e-9) / sky.illuminance(altitude + 1e-9)).toBeCloseTo(1, 6)
})

test.prop([fc.double({ max: -5 / 6, maxExcluded: true, min: -6, minExcluded: true, noNaN: true })])(
  'runs the logarithm of the illuminance linearly in altitude from -6° to -5/6°',
  (altitude) => {
    const low  = sky.illuminance(-6)
    const high = sky.illuminance(-5 / 6)

    expect(Math.log(sky.illuminance(altitude) / low))
      .toBeCloseTo(Math.log(high / low) * (altitude + 6) / (-5 / 6 + 6), 9)
  }
)

it('moves through -5/6° without a step at sunrise and sunset in Boston on 4 October 2026', () => {
  const sun   = new Sun(boston)
  const times = ['10:43', '10:44', '10:45', '10:46', '22:19', '22:20', '22:21', '22:22']

  expect(times.map((time) => Math.round(sky.illuminance(sun.altitude(new Date(`2026-10-04T${time}:00Z`))))))
    .toMatchInlineSnapshot(`
      [
        478,
        579,
        682,
        749,
        756,
        688,
        590,
        487,
      ]
    `)
})

it('returns the curve unclamped past the range HomeKit accepts', () => {
  expect(sky.illuminance(-20)).toBeLessThan(0.0001)
  expect(sky.illuminance(90)).toBeGreaterThan(100000)
})

test.prop([fc.double({ max: -5 / 6, maxExcluded: true, min: -90, noNaN: true })])(
  'adds no refraction below -5/6°',
  (altitude) => {
    expect(sky.refracted(altitude)).toBe(altitude)
  }
)

test.prop([fc.double({ max: 90, min: -90, noNaN: true })])(
  'stays positive and finite at every altitude',
  (altitude) => {
    expect(sky.illuminance(altitude)).toBeGreaterThan(0)
    expect(sky.illuminance(altitude)).toBeLessThan(Infinity)
  }
)

// Draws each rise at 1e-6° or more, which moves the curve past its rounding error
test.prop([fc.double({ max: 90, min: -18, noNaN: true }), fc.double({ max: 108, min: 1e-6, noNaN: true })])(
  'never dims as the sun climbs from astronomical twilight to the zenith',
  (low, rise) => {
    fc.pre(low + rise <= 90)

    expect(sky.illuminance(low + rise)).toBeGreaterThanOrEqual(sky.illuminance(low))
  }
)

// Lets the later growth exceed the earlier by 1e-9, the rounding error where the bridge holds it constant
test.prop([rising, climbing, rising])(
  'never grows faster per degree as the sun climbs from -6° to the zenith',
  (below, altitude, above) => {
    fc.pre(altitude - below >= -6 && altitude + above <= 90)

    const growth = (from: number, to: number): number =>
      Math.log(sky.illuminance(to) / sky.illuminance(from)) / (to - from)

    expect(growth(altitude, altitude + above)).toBeLessThanOrEqual(growth(altitude - below, altitude) + 1e-9)
  }
)
