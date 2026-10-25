import { expect, it } from 'vitest'

import { Sensor }                                from '../../src/sensor/sensor.js'
import { Bridge, NO_RESPONSE, detection, level } from '../common/homebridge.js'

const bridge  = new Bridge('')
const { hap } = bridge

it.each([
  { find: level,     kind: 'light',     service: hap.Service.LightSensor },
  { find: detection, kind: 'occupancy', service: hap.Service.OccupancySensor }
] as const)(
  'marks the $kind sensor of a cached accessory No Response, adding no second one',
  ({ find, kind, service }) => {
    const accessory = bridge.cached('Porch')

    new Sensor(accessory, bridge.api, kind)
    new Sensor(accessory, bridge.api, kind).fail()

    expect(find(accessory).statusCode).toBe(NO_RESPONSE)
    expect(accessory.services.filter(({ UUID }) => UUID === service.UUID)).toMatchObject([
      { displayName: 'Porch' }
    ])
  }
)
