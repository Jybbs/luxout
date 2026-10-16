import type { Place }     from '../../src/config/place.js'
import { ForecastWindow } from '../../src/weather/window.js'

/**
 * Parses `body` for `place`, throwing a `ValitaError` that names the issues
 * where the body fails.
 */
export function parsed(body: unknown, place: Place): ForecastWindow {
  const result = ForecastWindow.parse(body, place)

  return result.ok ? result.value : result.throw()
}

/**
 * Parses a window for `place` holding one step per irradiance, the first at
 * `start`, a date string or milliseconds since the Unix epoch, and each 900
 * seconds after the one before.
 */
export function spaced(irradiances: readonly number[], place: Place, start: number | string): ForecastWindow {
  const time = irradiances.map((_, index) => new Date(start).getTime() / 1000 + index * 900)

  return parsed({ minutely_15: { shortwave_radiation_instant: irradiances, time } }, place)
}
