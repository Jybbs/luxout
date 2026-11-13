import type { Place } from '../../../../src/config/place.ts'
import * as clock     from './clock.ts'

const FACTOR_DIGITS = 3     // The decimals a cloud factor other than exactly 1 takes
const SMALLEST      = 1e-4  // The lux below which a value takes scientific notation
const SUPERSCRIPTS  = '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'
const clockFormat   = clock.clockFormatIn('UTC')
const dayFormat     = clock.dateFormatIn('UTC')
const degreeFormat  = new Intl.NumberFormat('en-US', {
  maximumFractionDigits : 1,
  minimumFractionDigits : 1,
  signDisplay           : 'negative',
  style                 : 'unit',
  unit                  : 'degree',
  unitDisplay           : 'narrow'
})
export const listFormat = new Intl.ListFormat('en-US')
const preciseFormat     = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 })
const tinyFormat        = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, notation: 'scientific' })
const wholeFormat       = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/**
 * Writes `value` beside the full name of `unit`, as in `5 minutes`.
 */
export function formatAmount(value: number, unit: 'hour' | 'minute' | 'second'): string {
  return new Intl.NumberFormat('en-US', { style: 'unit', unit, unitDisplay: 'long' }).format(value)
}

/**
 * Writes `minute` past a midnight as a 24-hour clock time, in the minutes of a
 * day whose clock never changes.
 */
export function formatClock(minute: number): string {
  return clockFormat.format(minute * clock.MINUTE)
}

/**
 * Writes the day `index` days past the first of `year` as its month and date.
 */
export function formatDayOfYear(year: number, index: number): string {
  return dayFormat.format(Date.UTC(year, 0, index + 1))
}

/**
 * Writes an altitude in degrees to a tenth, with a true minus sign and no sign
 * on a value that rounds to zero.
 */
export function formatDegrees(degrees: number): string {
  return signed(degreeFormat.format(degrees))
}

/**
 * Writes a cloud factor to three decimals, or as `1` where it is exactly 1.
 */
export function formatFactor(factor: number): string {
  return factor === 1 ? '1' : factor.toFixed(FACTOR_DIGITS)
}

/**
 * Writes a lux value to the whole lux from 100 upward, to three significant
 * figures below it, and in scientific notation under HomeKit's floor.
 */
export function formatLux(lux: number): string {
  if (lux >= SMALLEST) return (lux >= 100 ? wholeFormat : preciseFormat).format(lux)

  const [mantissa, exponent] = tinyFormat.format(lux).split('E') as [string, string]

  return `${mantissa} × 10${exponent.replace(/./g, (digit) => SUPERSCRIPTS['-0123456789'.indexOf(digit)]!)}`
}

/**
 * Writes `place` as its latitude and longitude to two decimals, as the plugin
 * stores and sends them.
 */
export function formatPlace({ latitude, longitude }: Place): string {
  return `${latitude.toFixed(2)}, ${signed(longitude.toFixed(2))}`
}

/**
 * Writes a span of `milliseconds` in whole hours and minutes, as in `5 hours
 * and 45 minutes`.
 */
export function formatSpan(milliseconds: number): string {
  const hours   = Math.floor(milliseconds / clock.HOUR)
  const minutes = (milliseconds - hours * clock.HOUR) / clock.MINUTE

  return listFormat.format([
    ...hours ? [formatAmount(hours, 'hour')] : [],
    ...minutes ? [formatAmount(minutes, 'minute')] : []
  ])
}

/**
 * Writes a span of `steps` forecast steps in whole hours and minutes, as in
 * `5 hours and 45 minutes`.
 */
export function formatSteps(steps: number): string {
  return formatSpan(steps * clock.STEP_MINUTES * clock.MINUTE)
}

/**
 * Writes `figure` with a true minus sign in place of a leading hyphen.
 */
export function signed(figure: number | string): string {
  return String(figure).replace(/^-/, '−')
}
