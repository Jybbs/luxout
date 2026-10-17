import type { API, Characteristic, PlatformAccessory } from 'homebridge'

import manifest from '../../package.json' with { type: 'json' }

/**
 * Names the Outside accessory and its Light Sensor, and holds the serial number
 * its UUID is generated from, which no location and no rename changes.
 */
export const OUTSIDE = { name: 'Outside', serial: 'luxout-outside' }

/**
 * Exposes the outdoor reading through the Light Sensor of an accessory, whose
 * Accessory Information names Luxout and the version of the package.
 */
export class OutsideSensor {
  readonly #level: Characteristic

  constructor(accessory: PlatformAccessory, api: API) {
    const { Characteristic, Service } = api.hap

    accessory.getService(Service.AccessoryInformation)
      ?.setCharacteristic(Characteristic.FirmwareRevision, manifest.version)
      .setCharacteristic(Characteristic.Manufacturer, manifest.displayName)
      .setCharacteristic(Characteristic.Model, manifest.displayName)
      .setCharacteristic(Characteristic.SerialNumber, OUTSIDE.serial)

    const sensor = accessory.getService(Service.LightSensor)
                ?? accessory.addService(Service.LightSensor, OUTSIDE.name)

    this.#level = sensor.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
  }

  /**
   * Marks the sensor "No Response" in the Home app until a reading replaces the
   * error.
   */
  fail(): void {
    this.#level.updateValue(new Error('Outside holds no reading'))
  }

  /**
   * Pushes `lux` clamped into the range `CurrentAmbientLightLevel` accepts.
   *
   * Returns:
   *   The reading the sensor shows.
   */
  report(lux: number): number {
    const { maxValue = Infinity, minValue = -Infinity } = this.#level.props
    const shown = Math.min(Math.max(lux, minValue), maxValue)

    this.#level.updateValue(shown)

    return shown
  }
}
