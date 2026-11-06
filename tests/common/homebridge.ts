import { EventEmitter } from 'node:events'

import * as hap       from '@homebridge/hap-nodejs'
import type { API, Characteristic, Logging, PlatformAccessory } from 'homebridge'
import { expect, vi } from 'vitest'

import { OUTSIDE }         from '../../src/sensor/outside.js'
import { test as scratch } from './scratch.js'

export const NO_RESPONSE = -70402  // HAP's SERVICE_COMMUNICATION_FAILURE, shown as No Response

/**
 * Extends the scratch fixture with a stopped clock, a `log` standing in for the
 * `Logging` Homebridge hands the platform, and a `bridge` whose storage path is
 * the scratch directory.
 */
export const test = scratch
  .extend('clock', { auto: true }, ({ onTestFinished }) => {
    vi.useFakeTimers({ now: new Date('2026-10-11T02:07:30Z') })
    onTestFinished(() => {
      vi.useRealTimers()
    })
  })
  .extend('bridge', ({ scratch }) => new Bridge(scratch))
  .extend('log', () => logging())

/**
 * Stands in for the `PlatformAccessory` Homebridge builds, as the HAP accessory
 * it wraps beside the `context` Homebridge saves with it.
 */
class Accessory extends hap.Accessory {
  readonly context = {}
}

/**
 * Stands in for the `api` Homebridge hands the platform, serving the real HAP,
 * firing each lifecycle event a test emits, and recording each accessory the
 * platform registers, unregisters, or saves to the cache.
 */
export class Bridge extends EventEmitter {
  readonly hap                           = hap
  readonly platformAccessory             = Accessory
  readonly registerPlatformAccessories   = vi.fn<API['registerPlatformAccessories']>()
  readonly unregisterPlatformAccessories = vi.fn<API['unregisterPlatformAccessories']>()
  readonly updatePlatformAccessories     = vi.fn<API['updatePlatformAccessories']>()
  readonly user                          : { storagePath: () => string }

  constructor(storage: string) {
    super()
    this.user = { storagePath: () => storage }
  }

  get api(): API {
    return this as unknown as API
  }

  /**
   * Builds an accessory as Homebridge restores one from its cache.
   */
  cached(name = OUTSIDE.name, serial = OUTSIDE.serial): PlatformAccessory {
    return new Accessory(name, hap.uuid.generate(serial)) as unknown as PlatformAccessory
  }
}

/**
 * Finds the occupancy the Occupancy Sensor of `accessory` holds.
 */
export function detection(accessory: PlatformAccessory): Characteristic {
  const sensor = accessory.getService(hap.Service.OccupancySensor)

  return sensor?.getCharacteristic(hap.Characteristic.OccupancyDetected)
      ?? expect.unreachable('The accessory holds no Occupancy Sensor')
}

/**
 * Finds the light level the Light Sensor of `accessory` holds.
 */
export function level(accessory: PlatformAccessory): Characteristic {
  const sensor = accessory.getService(hap.Service.LightSensor)

  return sensor?.getCharacteristic(hap.Characteristic.CurrentAmbientLightLevel)
      ?? expect.unreachable('The accessory holds no Light Sensor')
}

/**
 * Builds a callable `Logging` whose every level is a mock.
 */
export function logging(): Logging {
  return Object.assign(vi.fn<(message: string, ...parameters: unknown[]) => void>(), {
    debug   : vi.fn<Logging['debug']>(),
    error   : vi.fn<Logging['error']>(),
    info    : vi.fn<Logging['info']>(),
    log     : vi.fn<Logging['log']>(),
    prefix  : 'Luxout',
    success : vi.fn<Logging['success']>(),
    warn    : vi.fn<Logging['warn']>()
  })
}
