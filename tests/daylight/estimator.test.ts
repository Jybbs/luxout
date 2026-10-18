import { fc, test }   from '@fast-check/vitest'
import { expect, it } from 'vitest'

import { ClearSky }    from '../../src/daylight/clear-sky.js'
import { CloudFactor } from '../../src/daylight/cloud-factor.js'
import { Estimator }   from '../../src/daylight/estimator.js'
import { Sun }         from '../../src/daylight/sun.js'
import { delhi }       from '../common/places.js'
import { parsed }      from '../common/window.js'
import dawn            from './fixtures/dawn.json' with { type: 'json' }

const instants = fc.date({
  max           : new Date('2026-10-11T06:45:00Z'),
  min           : new Date('2026-10-11T00:00:00Z'),
  noInvalidDate : true
})
const sky       = new ClearSky()
const sun       = new Sun(delhi)
const estimator = new Estimator(sky, sun)
const morning   = new CloudFactor(sky, sun, parsed(dawn, delhi))

it('scales the clear-sky illuminance at the sun’s altitude by the cloud factor around the instant', () => {
  const estimate = estimator.estimate(new Date('2026-10-11T02:07:30Z'), morning)

  expect(estimate).toMatchInlineSnapshot(`
    Estimate {
      "altitude": 15.869171114189513,
      "clearSky": 22187.473330905093,
      "factor": 0.4421582988441151,
      "steps": [
        {
          "factor": 0.44645215980201053,
          "time": 1791684000000,
        },
        {
          "factor": 0.4378644378862197,
          "time": 1791684900000,
        },
      ],
    }
  `)
  expect(estimate.lux).toMatchInlineSnapshot(`9810.375463642169`)
})

it.each([
  { factor: undefined, instant: '2026-10-11T02:07:30Z', name: 'no cloud factor' },
  { factor: morning,   instant: '2026-10-11T06:45:01Z', name: 'a cloud factor whose window ends before it' }
])('reports the clear-sky illuminance alone at an instant with $name', ({ factor, instant }) => {
  const estimate = estimator.estimate(new Date(instant), factor)

  expect(estimate).toMatchObject({ factor: 1, steps: undefined })
  expect(estimate.lux).toBe(sky.illuminance(estimate.altitude))
})

it.each([
  { earlier: undefined, name: 'alone' },
  { earlier: morning,   name: 'beside the factor it replaces' }
])('derives the cloud factor of a window $name under its own sun and clear sky', ({ earlier }) => {
  const window  = parsed(dawn, delhi)
  const instant = new Date('2026-10-11T00:37:30Z')

  expect(estimator.derive(window, earlier).at(instant))
    .toEqual(new CloudFactor(sky, sun, window, earlier).at(instant))
})

test.prop([instants])('never estimates past the clear-sky illuminance at the same altitude', (instant) => {
  const estimate = estimator.estimate(instant, morning)

  expect(estimate.lux).toBeLessThanOrEqual(estimate.clearSky)
})
