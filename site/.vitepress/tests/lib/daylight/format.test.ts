import { expect, it } from 'vitest'

import * as format  from '../../../lib/daylight/format.ts'
import { luxRange } from '../../../lib/daylight/homekit.ts'

it.each([
  { expected: '74,000', lux: 74_000 },
  { expected: '100', lux: 100.4 },
  { expected: '99.5', lux: 99.51 }
])('writes $lux lux as $expected', ({ expected, lux }) => {
  expect(format.formatLux(lux)).toBe(expected)
})

it('writes HomeKit’s floor plainly and what sits under it in scientific notation', () => {
  expect(format.formatLux(luxRange.min)).toBe('0.0001')
  expect(format.formatLux(luxRange.min * 0.99)).toBe('9.9 × 10⁻⁵')
})

it('writes a minute past midnight as a 24-hour clock time', () => {
  expect([0, 615, 1439].map(format.formatClock)).toEqual(['00:00', '10:15', '23:59'])
})

it.each([
  { expected: 'January 1', index: 0, year: 2026 },
  { expected: 'March 2', index: 60, year: 2026 },
  { expected: 'March 1', index: 60, year: 2028 }
])('writes day $index of $year as $expected', ({ expected, index, year }) => {
  expect(format.formatDayOfYear(year, index)).toBe(expected)
})

it.each([
  { expected: '1', factor: 1 },
  { expected: '0.900', factor: 0.9 },
  { expected: '0.812', factor: 0.8123 }
])('writes a cloud factor of $factor as $expected', ({ expected, factor }) => {
  expect(format.formatFactor(factor)).toBe(expected)
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

it.each([
  { expected: '1 minute', milliseconds: 60_000 },
  { expected: '1 hour', milliseconds: 3_600_000 },
  { expected: '5 hours and 45 minutes', milliseconds: 20_700_000 }
])('writes a span of $milliseconds ms as $expected', ({ expected, milliseconds }) => {
  expect(format.formatSpan(milliseconds)).toBe(expected)
})
