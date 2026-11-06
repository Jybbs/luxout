import type { API, Logging, PlatformAccessory } from 'homebridge'

import type { ThresholdEntry } from '../config/threshold.js'
import { figure }              from './figure.js'
import { Sensor, inform }      from './sensor.js'

/**
 * Exposes one entry under `thresholds` through the Occupancy Sensor of an
 * accessory of its own, detected while the entry's levels hold it on.
 */
export class ThresholdSensor extends Sensor {
  readonly #accessory : PlatformAccessory
  readonly #api       : API
  readonly #entry     : ThresholdEntry
  readonly #log       : Logging

  constructor(accessory: PlatformAccessory, api: API, entry: ThresholdEntry, log: Logging) {
    super(accessory, api, 'occupancy')
    inform(accessory, api, entry.serial)

    this.#accessory = accessory
    this.#api       = api
    this.#entry     = entry
    this.#log       = log
  }

  /**
   * Switches the sensor where the reading `lux` crosses a level of its entry,
   * logging the switch and saving the accessory to Homebridge's cache, and
   * keeps the state the sensor holds, restored or off, inside the gap.
   */
  compare(lux: number): void {
    const { OCCUPANCY_DETECTED, OCCUPANCY_NOT_DETECTED } = this.#api.hap.Characteristic.OccupancyDetected

    const detected = this.characteristic.value === OCCUPANCY_DETECTED
    const next     = this.#entry.detects(detected, lux)

    if (next === detected) return

    this.characteristic.updateValue(next ? OCCUPANCY_DETECTED : OCCUPANCY_NOT_DETECTED)
    this.#log.info(
      '%s switches %s at a reading of %s lux',
      this.#entry.name,
      next ? 'on' : 'off',
      figure.format(lux)
    )
    this.#api.updatePlatformAccessories([this.#accessory])
  }
}
