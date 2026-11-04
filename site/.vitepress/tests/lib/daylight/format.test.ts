import { expect, it } from 'vitest'

import * as format from '../../../lib/daylight/format.ts'

it.each([
  { expected: '74,000', lux: 74_000 },
  { expected: '100', lux: 100.4 },
  { expected: '99.5', lux: 99.51 },
  { expected: '0.0001', lux: 0.0001 }
])('writes $lux lux as $expected', ({ expected, lux }) => {
  expect(format.formatLux(lux)).toBe(expected)
})

it('writes an altitude to a tenth of a degree with a true minus sign', () => {
  expect(format.formatDegrees(-5.83)).toBe('−5.8°')
})

it('writes no sign on an altitude that rounds to zero', () => {
  expect(format.formatDegrees(-0.04)).toBe('0.0°')
})

it('writes a true minus sign in place of a leading hyphen, in a number or a string', () => {
  expect([format.signed(-71.06), format.signed('42.36')]).toEqual(['−71.06', '42.36'])
})
