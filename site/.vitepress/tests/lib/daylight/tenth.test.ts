import { expect, it } from 'vitest'

import { tenth } from '../../../lib/daylight/tenth.ts'

it.each([
  { expected: 12.3, value: 12.34 },
  { expected: 12.4, value: 12.35 },
  { expected: -1.2, value: -1.21 }
])('rounds the coordinate $value to $expected', ({ expected, value }) => {
  expect(tenth(value)).toBe(expected)
})
