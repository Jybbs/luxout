import { expect, it } from 'vitest'

import { TWILIGHT } from '../../../../../src/daylight/clear-sky.ts'
import * as curve   from '../../../lib/daylight/sun-curve.ts'

const DAY: curve.SunDay = {
  altitudes : [-30, -10, 10, 30, 10],
  peak      : { altitude: 30, minute: 90 },
  rise      : 30,
  set       : 120
}
const wide = curve.SUN_LAYOUTS[1]

it('places the clock’s ends on the left and right of the layout', () => {
  expect([wide.xOf(0), wide.xOf(1440)]).toEqual([wide.left, wide.right])
})

it('places the horizon and straight overhead at the bottom and top of the layout', () => {
  expect([wide.yOf(0), wide.yOf(90)]).toEqual([wide.horizon, wide.top])
})

it('places a mark on a minute of the clock and the sun at an altitude', () => {
  expect([wide.moveAcross(0), wide.moveUp(30)]).toEqual(['translate(30 0)', 'translate(0 138.7)'])
})

it('places the top of a day’s path over the mark on it', () => {
  expect([wide.moveTo(DAY), wide.moveOver(DAY)]).toEqual(['translate(66.4 138.7)', 'translate(66.4 126.7)'])
})

it('finds the altitude on the line between the two samples around a minute', () => {
  expect(curve.altitudeOn(DAY, 0)).toBe(-30)
  expect(curve.altitudeOn(DAY, curve.SUN_GRID / 2)).toBe(-20)
  expect(curve.altitudeOn(DAY, curve.SUN_GRID * 2)).toBe(10)
})

it('writes an altitude to a tenth, and sunset as its exact fraction', () => {
  expect(curve.altitudeWord(-6)).toBe('−6.0°')
  expect(curve.altitudeWord(-0.8)).toBe('−0.8°')
  expect(curve.altitudeWord(TWILIGHT.sunset)).toBe(curve.SUNSET_WORD)
})

it('writes the top of the path as its height and its clock time', () => {
  expect(curve.peakWord(DAY)).toBe('30.0° at 01:30')
})

it('draws the curve in minutes across and degrees up, with the horizon on 0', () => {
  expect(curve.sunCurve(DAY)).toBe('M0,30L30,10L60,-10L90,-30L120,-10')
})

it.each([
  [10,              60,  'the sun stands 10.0° above the horizon, climbing toward 30.0° at 01:30.'],
  [10,              100, 'the sun stands 10.0° above the horizon, sinking toward sunset at 02:00.'],
  [TWILIGHT.sunset, 30,  'the sun stands 0.8° below the horizon, climbing toward 30.0° at 01:30.'],
  [-20,             15,  'the sun is 20.0° below the horizon and rises at 00:30.'],
  [-20,             130, 'the sun is 20.0° below the horizon, having set at 02:00.']
])('writes %s° at minute %s as: %s', (altitude, minute, words) => {
  expect(curve.sunPhrase(DAY, altitude, minute)).toBe(words)
})
