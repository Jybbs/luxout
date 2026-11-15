import { expect, it } from 'vitest'

import * as format                      from '../../../lib/daylight/format.ts'
import { factsAt, positionOf, valueAt } from '../../../lib/front/facts.ts'
import type { FrontDay }                from '../../../lib/front/front.ts'

const day: FrontDay = {
  altitudes  : [-40, 10, 50],
  clearSkies : [1e-6, 500, 2e5],
  factors    : [null, 0.5, 1],
  noon       : 2,
  phases     : [{ from: 0, name: 'Night' }, { from: 1, name: 'Daylight' }],
  range      : { max: 1e5, min: 1e-4 },
  readings   : [1e-4, 250, 1e5],
  rise       : 1,
  set        : 2,
  window     : [1, 2]
}

it.each([
  [0, '<'],
  [1, ''],
  [2, '>']
] as const)(
  'marks the end of HomeKit’s range the clear sky at minute %i lies past as “%s”',
  (minute, beyond) => {
    expect(factsAt(day, minute).beyond).toBe(beyond)
  }
)

it.each([
  [0, day.range.min],
  [1, 500],
  [2, day.range.max]
])('prints the clear sky at minute %i held inside HomeKit’s range, at %d lux', (minute, lux) => {
  expect(factsAt(day, minute).clear).toBe(format.formatLux(lux))
})

it.each([
  [0, null],
  [1, format.formatFactor(0.5)]
])('prints the cloud factor at minute %i as %s, null where no forecast step covers it', (minute, factor) => {
  expect(factsAt(day, minute).factor).toBe(factor)
})

it.each([
  [0.6, 1],
  [-5, 0],
  [9, 2]
])('reads minute %d as the whole minute %i it rounds to, held to the day’s ends', (minute, whole) => {
  expect(factsAt(day, minute).time).toBe(format.formatClock(whole))
})

it.each([
  [0, 'Night'],
  [2, 'Daylight']
])('names the phase whose run holds minute %i as %s', (minute, phase) => {
  expect(factsAt(day, minute).phase).toBe(phase)
})

it.each([
  [1e-4, 0],
  [1e-9, 0],
  [1e5, 1],
  [1e7, 1],
  [Math.sqrt(1e-4 * 1e5), 0.5]
])('places %d lux at %d along HomeKit’s range', (lux, share) => {
  expect(positionOf(day, lux)).toBeCloseTo(share, 9)
})

it.each([
  [0.25, 12.5],
  [1, 50],
  [1.5, 125],
  [-1, 0],
  [4, 200]
])('reads %d minutes between the whole minutes around it as %d, held to the ends', (minute, value) => {
  expect(valueAt([0, 50, 200], minute)).toBe(value)
})
