import { fc, test }   from '@fast-check/vitest'
import { expect, it } from 'vitest'

import manifest                       from '../../package.json' with { type: 'json' }
import { OutsideSensor }              from '../../src/sensor/outside.js'
import { Bridge, NO_RESPONSE, level } from '../common/homebridge.js'

const bridge                      = new Bridge('')
const { Characteristic, Service } = bridge.hap

it('names Luxout, its version, and the serial the UUID comes from in the Accessory Information', () => {
  const accessory   = bridge.cached()
  const information = accessory.getService(Service.AccessoryInformation)

  new OutsideSensor(accessory, bridge.api)

  expect({
    firmware     : information?.getCharacteristic(Characteristic.FirmwareRevision).value,
    manufacturer : information?.getCharacteristic(Characteristic.Manufacturer).value,
    model        : information?.getCharacteristic(Characteristic.Model).value,
    serial       : information?.getCharacteristic(Characteristic.SerialNumber).value
  }).toEqual({
    firmware     : manifest.version,
    manufacturer : 'Luxout',
    model        : 'Luxout',
    serial       : 'luxout-outside'
  })
})

it('adds one Light Sensor named Outside, and adds none to an accessory already holding it', () => {
  const accessory = bridge.cached()

  new OutsideSensor(accessory, bridge.api)
  new OutsideSensor(accessory, bridge.api)

  expect(accessory.services.filter((service) => service.UUID === Service.LightSensor.UUID)).toMatchObject([
    { displayName: 'Outside' }
  ])
})

it.each([
  { lux: -1,       shown: 0.0001 },
  { lux: 0,        shown: 0.0001 },
  { lux: 0.0001,   shown: 0.0001 },
  { lux: 9810.375, shown: 9810.375 },
  { lux: 100000,   shown: 100000 },
  { lux: 123786,   shown: 100000 }
])('shows $lux lux as $shown', ({ lux, shown }) => {
  const sensor = new OutsideSensor(bridge.cached(), bridge.api)

  expect(sensor.report(lux)).toBe(shown)
})

test.prop([fc.double({ noNaN: true })])('shows every reading inside the range HomeKit accepts', (lux) => {
  const accessory = bridge.cached()

  new OutsideSensor(accessory, bridge.api).report(lux)

  expect(level(accessory).value).toBeGreaterThanOrEqual(0.0001)
  expect(level(accessory).value).toBeLessThanOrEqual(100000)
})

it('marks the sensor No Response until a reading replaces the error', () => {
  const accessory = bridge.cached()
  const sensor    = new OutsideSensor(accessory, bridge.api)

  sensor.fail()

  expect(level(accessory).statusCode).toBe(NO_RESPONSE)

  sensor.report(250)

  expect(level(accessory)).toMatchObject({ statusCode: 0, value: 250 })
})
