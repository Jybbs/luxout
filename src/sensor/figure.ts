/**
 * Formats a number the plugin logs to at most four significant digits and four
 * decimals, with no grouping.
 */
export const figure = new Intl.NumberFormat('en-US', {
  maximumFractionDigits    : 4,
  maximumSignificantDigits : 4,
  roundingPriority         : 'lessPrecision',
  useGrouping              : false
})
