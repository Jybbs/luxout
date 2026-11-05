export const DAY_MINUTES  = 1440
export const HOUR_MARKS   = [0, 6, 12, 18, 24]
export const MINUTE       = 60_000  // Milliseconds
export const STEP_MINUTES = 15      // The minutes between two steps of a forecast
export const DAY          = DAY_MINUTES * MINUTE

/**
 * Builds the format that writes a 24-hour clock time in `timeZone`.
 */
export function clockFormatIn(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', { hour: '2-digit', hourCycle: 'h23', minute: '2-digit', timeZone })
}

/**
 * Builds the format that writes a month and a date in `timeZone`.
 */
export function dateFormatIn(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', timeZone })
}

/**
 * Writes `hour` of the clock as two digits.
 */
export function hourWord(hour: number): string {
  return String(hour).padStart(2, '0')
}
