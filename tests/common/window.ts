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
