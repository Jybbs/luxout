import { Characteristic } from '@homebridge/hap-nodejs'
import { expect, it }     from 'vitest'

import { clampLux, luxRange } from '../../../lib/daylight/homekit.ts'

it('reads the range from the props HAP-NodeJS sets on the characteristic', () => {
  const { maxValue, minValue } = new Characteristic.CurrentAmbientLightLevel().props

  expect(luxRange).toEqual({ max: maxValue, min: minValue })
})

it.each([
  { expected: luxRange.min, lux: 0, name: 'raises a dark reading to the floor' },
  { expected: 500, lux: 500, name: 'keeps a reading inside the range' },
  { expected: luxRange.max, lux: 200_000, name: 'lowers a reading past the ceiling' }
])('$name', ({ expected, lux }) => {
  expect(clampLux(lux)).toBe(expected)
})
