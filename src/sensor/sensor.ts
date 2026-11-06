import type { API, Characteristic, PlatformAccessory } from 'homebridge'

import manifest from '../../package.json' with { type: 'json' }

type Kind = keyof typeof KINDS

const KINDS = {
  light     : { characteristic: 'CurrentAmbientLightLevel', service: 'LightSensor' },
  occupancy : { characteristic: 'OccupancyDetected',        service: 'OccupancySensor' }
} as const

/**
 * Exposes one value of an accessory through the HomeKit service its kind
 * names, which it finds by type whatever the user renamed it to, or adds under
 * the accessory's name.
 */
export class Sensor {
  readonly #characteristic: Characteristic

  constructor(accessory: PlatformAccessory, api: API, kind: Kind) {
    const { Characteristic, Service } = api.hap
    const { characteristic, service } = KINDS[kind]
    const type                        = Service[service]
    const found = accessory.getService(type) ?? accessory.addService(type, accessory.displayName)

    this.#characteristic = found.getCharacteristic(Characteristic[characteristic])
  }

  protected get characteristic(): Characteristic {
    return this.#characteristic
  }

  /**
   * Marks the sensor "No Response" in the Home app until a value replaces the
   * error.
   */
  fail(): void {
    this.#characteristic.updateValue(new Error('The sensor holds no reading'))
  }
}

/**
 * Sets the Accessory Information of `accessory` to name Luxout, the version of
 * the package, and `serial`, the input its UUID is generated from.
 */
export function inform(accessory: PlatformAccessory, api: API, serial: string): void {
  const { Characteristic, Service } = api.hap

  accessory.getService(Service.AccessoryInformation)
    ?.setCharacteristic(Characteristic.FirmwareRevision, manifest.version)
    .setCharacteristic(Characteristic.Manufacturer, manifest.displayName)
    .setCharacteristic(Characteristic.Model, manifest.displayName)
    .setCharacteristic(Characteristic.SerialNumber, serial)
}
