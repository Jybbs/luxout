import { Characteristic } from '@homebridge/hap-nodejs'
import { clamp }          from '@vueuse/core'

const { maxValue = Infinity, minValue = -Infinity } = new Characteristic.CurrentAmbientLightLevel().props
/**
 * The lux range `CurrentAmbientLightLevel` declares through the `props`
 * HAP-NodeJS sets on it.
 */
export const luxRange = { max: maxValue, min: minValue }

/**
 * Clamps `lux` into the range the Outside sensor writes.
 */
export function clampLux(lux: number): number {
  return clamp(lux, luxRange.min, luxRange.max)
}
