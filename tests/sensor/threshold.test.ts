import { fc, test }                        from '@fast-check/vitest'
import type { Logging, PlatformAccessory } from 'homebridge'
import { expect, it }                      from 'vitest'

import manifest                                    from '../../package.json' with { type: 'json' }
import { ThresholdSensor }                         from '../../src/sensor/threshold.js'
import { Bridge, NO_RESPONSE, detection, logging } from '../common/homebridge.js'
import { thresholdEntry }                          from '../common/threshold.js'

const DUSK                        = thresholdEntry({ name: 'Dusk', offLux: 662, onLux: 2.99 })
const { Characteristic, Service } = new Bridge('').hap

it('names Luxout, its version, and the serial of its entry in the Accessory Information', () => {
  const bridge      = new Bridge('')
  const accessory   = bridge.cached(DUSK.name, DUSK.serial)
  const information = accessory.getService(Service.AccessoryInformation)

  new ThresholdSensor(accessory, bridge.api, DUSK, logging())

  expect({
    firmware     : information?.getCharacteristic(Characteristic.FirmwareRevision).value,
    manufacturer : information?.getCharacteristic(Characteristic.Manufacturer).value,
    model        : information?.getCharacteristic(Characteristic.Model).value,
    serial       : information?.getCharacteristic(Characteristic.SerialNumber).value
  }).toEqual({
    firmware     : manifest.version,
    manufacturer : 'Luxout',
    model        : 'Luxout',
    serial       : 'luxout-threshold-Dusk'
  })
})

it('adds one Occupancy Sensor named for its entry, and finds it again once the user renames it', () => {
  const bridge    = new Bridge('')
  const accessory = bridge.cached(DUSK.name, DUSK.serial)

  new ThresholdSensor(accessory, bridge.api, DUSK, logging())
  accessory.getService(Service.OccupancySensor)?.setCharacteristic(Characteristic.Name, 'Porch Dusk')
  new ThresholdSensor(accessory, bridge.api, DUSK, logging())

  expect(accessory.services.filter(({ UUID }) => UUID === Service.OccupancySensor.UUID)).toHaveLength(1)
})

it.each([
  { lux: 2.99, start: false, state: 'on' },
  { lux: 700,  start: true,  state: 'off' }
])(
  'switches $state at a reading of $lux lux, logging it and saving the accessory',
  ({ lux, start, state }) => {
    const { accessory, bridge, log, sensor } = built(start)

    sensor.compare(lux)

    expect(detection(accessory).value).toBe(Number(!start))
    expect(log.info).toHaveBeenCalledExactlyOnceWith(
      '%s switches %s at a reading of %s lux',
      'Dusk',
      state,
      String(lux)
    )
    expect(bridge.updatePlatformAccessories).toHaveBeenCalledExactlyOnceWith([accessory])
  }
)

it.each([true, false])(
  'keeps the state %s a restart restored through a first reading inside the gap',
  (start) => {
    const { accessory, bridge, log, sensor } = built(start)

    sensor.compare(300)

    expect(detection(accessory).value).toBe(Number(start))
    expect(log.info).not.toHaveBeenCalled()
    expect(bridge.updatePlatformAccessories).not.toHaveBeenCalled()
  }
)

it('starts off on a new accessory whose first reading sits inside the gap', () => {
  const bridge    = new Bridge('')
  const accessory = bridge.cached(DUSK.name, DUSK.serial)

  new ThresholdSensor(accessory, bridge.api, DUSK, logging()).compare(300)

  expect(detection(accessory).value).toBe(Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED)
})

it('logs and saves nothing for a reading that leaves its state as it stands', () => {
  const { bridge, log, sensor } = built(true)

  sensor.compare(1)

  expect(log.info).not.toHaveBeenCalled()
  expect(bridge.updatePlatformAccessories).not.toHaveBeenCalled()
})

test.prop([fc.array(fc.double({ max: 662, min: 2.991, noNaN: true }), { minLength: 1 }), fc.boolean()])(
  'never switches while every reading stays inside the gap',
  (readings, start) => {
    const { log, sensor } = built(start)

    for (const lux of readings) sensor.compare(lux)

    expect(log.info).not.toHaveBeenCalled()
  }
)

it('marks the sensor No Response until a switch replaces the error', () => {
  const { accessory, sensor } = built(false)

  sensor.fail()

  expect(detection(accessory).statusCode).toBe(NO_RESPONSE)

  sensor.compare(1)

  expect(detection(accessory)).toMatchObject({ statusCode: 0, value: 1 })
})

/**
 * Builds the Dusk sensor on an accessory whose Occupancy Sensor holds `start`,
 * as a restart restores it, beside the bridge and the log it reports through.
 */
function built(start: boolean): {
  accessory : PlatformAccessory
  bridge    : Bridge
  log       : Logging
  sensor    : ThresholdSensor
} {
  const bridge    = new Bridge('')
  const accessory = bridge.cached(DUSK.name, DUSK.serial)
  const log       = logging()
  const sensor    = new ThresholdSensor(accessory, bridge.api, DUSK, log)

  detection(accessory).updateValue(Number(start))

  return { accessory, bridge, log, sensor }
}
