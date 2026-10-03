import type { DynamicPlatformPlugin, PlatformAccessory } from 'homebridge'
import { expect, it }                                   from 'vitest'

import { LuxoutPlatform } from '../../src/platform/dynamic.js'

it('restores a cached accessory without changing it', () => {
  const accessory                       = Object.freeze({}) as PlatformAccessory
  const platform: DynamicPlatformPlugin = new LuxoutPlatform()

  expect(() => platform.configureAccessory(accessory)).not.toThrow()
})
