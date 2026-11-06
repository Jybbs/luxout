import type { API, PlatformAccessory } from 'homebridge'

import { Sensor, inform } from './sensor.js'

/**
 * Names the Outside accessory and its Light Sensor, and holds the serial number
 * its UUID is generated from, which no location and no rename changes.
 */
export const OUTSIDE = { name: 'Outside', serial: 'luxout-outside' }

/**
 * Exposes the outdoor reading through the Light Sensor of an accessory, whose
 * Accessory Information names Luxout and the version of the package.
 */
export class OutsideSensor extends Sensor {
  constructor(accessory: PlatformAccessory, api: API) {
    super(accessory, api, 'light')
    inform(accessory, api, OUTSIDE.serial)
  }

  /**
   * Pushes `lux` clamped into the range `CurrentAmbientLightLevel` accepts.
   *
   * Returns:
   *   The reading the sensor shows.
   */
  report(lux: number): number {
    const { maxValue = Infinity, minValue = -Infinity } = this.characteristic.props
    const shown = Math.min(Math.max(lux, minValue), maxValue)

    this.characteristic.updateValue(shown)

    return shown
  }
}
