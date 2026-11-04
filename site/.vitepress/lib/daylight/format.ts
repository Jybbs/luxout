export const clockListFormat = new Intl.ListFormat('en-US')
const degreeFormat           = new Intl.NumberFormat('en-US', {
  maximumFractionDigits : 1,
  minimumFractionDigits : 1,
  signDisplay           : 'negative',
  style                 : 'unit',
  unit                  : 'degree',
  unitDisplay           : 'narrow'
})
const preciseFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 })
const wholeFormat   = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/**
 * Writes an altitude in degrees to a tenth, with a true minus sign and no sign
 * on a value that rounds to zero.
 */
export function formatDegrees(degrees: number): string {
  return signed(degreeFormat.format(degrees))
}

/**
 * Writes a lux value to the whole lux from 100 upward and to three significant
 * figures below it.
 */
export function formatLux(lux: number): string {
  return (lux >= 100 ? wholeFormat : preciseFormat).format(lux)
}

/**
 * Writes `figure` with a true minus sign in place of a leading hyphen.
 */
export function signed(figure: number | string): string {
  return String(figure).replace(/^-/, '−')
}
