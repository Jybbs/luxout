import type { API, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig } from 'homebridge'

import schema                     from '../../config.schema.json' with { type: 'json' }
import manifest                   from '../../package.json' with { type: 'json' }
import { keysAtFault }            from '../config/fields.js'
import { Settings }               from '../config/settings.js'
import { ClearSky }               from '../daylight/clear-sky.js'
import { Estimator }              from '../daylight/estimator.js'
import { Sun }                    from '../daylight/sun.js'
import { OUTSIDE, OutsideSensor } from '../sensor/outside.js'
import { Reading }                from '../sensor/reading.js'
import { Sensor }                 from '../sensor/sensor.js'
import { ThresholdSensor }        from '../sensor/threshold.js'
import { ForecastClient }         from '../weather/client.js'
import { FetchSchedule }          from '../weather/schedule.js'
import { WindowStore }            from '../weather/store.js'

interface Collaborators {
  fetch?  : typeof fetch
  random? : (max: number) => number
}

/**
 * Registers the Outside accessory and one accessory per threshold entry for a
 * block whose settings parse, fetches the forecast for it each hour, and reads
 * the light outdoors on it each minute. A block that fails leaves the platform
 * idle apart from one line naming the settings at fault, with every cached
 * accessory marked "No Response". An entry that fails starts no sensor and logs
 * one line, marking the cached accessory its name identifies the same way.
 */
export class LuxoutPlatform implements DynamicPlatformPlugin {
  readonly #accessories   : Map<string, PlatformAccessory>
  readonly #api           : API
  readonly #collaborators : Collaborators
  readonly #log           : Logging
  readonly #settings      : Settings | undefined
  readonly #shutdown      : AbortController

  constructor(log: Logging, config: PlatformConfig, api: API, collaborators: Collaborators = {}) {
    const settings = Settings.parse(config)

    this.#accessories   = new Map()
    this.#api           = api
    this.#collaborators = collaborators
    this.#log           = log
    this.#settings      = settings.ok ? settings.value : undefined
    this.#shutdown      = new AbortController()

    if (settings.ok) {
      for (const { line } of settings.value.faults) log.warn(line)
    } else {
      log.warn('Outside reads nothing until the settings hold a valid %s', keysAtFault(settings))
    }

    api.on('didFinishLaunching', () => {
      this.#launch().catch((error: unknown) => log.error('Outside could not start reading: %s', error))
    })
    api.on('shutdown', () => this.#shutdown.abort())
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.#accessories.set(accessory.UUID, accessory)
  }

  async #launch(): Promise<void> {
    const { generate } = this.#api.hap.uuid
    const outside      = generate(OUTSIDE.serial)

    if (this.#settings === undefined) {
      for (const accessory of this.#accessories.values()) {
        new Sensor(accessory, this.#api, accessory.UUID === outside ? 'light' : 'occupancy').fail()
      }

      return
    }

    const { fetch, random }             = this.#collaborators
    const { faults, place, thresholds } = this.#settings
    const claimed                       = new Map<string, PlatformAccessory>()
    const claim                         = (name: string, uuid: string): PlatformAccessory => {
      const accessory = this.#accessories.get(uuid) ?? new this.#api.platformAccessory(name, uuid)

      claimed.set(uuid, accessory)

      return accessory
    }

    for (const { serial } of faults) {
      const cached = serial === undefined ? undefined : this.#accessories.get(generate(serial))

      if (cached) new Sensor(claim(cached.displayName, cached.UUID), this.#api, 'occupancy').fail()
    }

    const sensors = thresholds.map((entry) =>
      new ThresholdSensor(claim(entry.name, generate(entry.serial)), this.#api, entry, this.#log)
    )
    const reading = new Reading(
      new Estimator(new ClearSky(), new Sun(place)),
      this.#log,
      new OutsideSensor(claim(OUTSIDE.name, outside), this.#api),
      sensors
    )
    const schedule = new FetchSchedule(
      new ForecastClient(fetch),
      this.#log,
      place,
      reading,
      new WindowStore(this.#api.user.storagePath()),
      random
    )
    const stale = this.#accessories.values()
      .filter((accessory) => !claimed.has(accessory.UUID))
      .toArray()
    const fresh = claimed.values()
      .filter((accessory) => !this.#accessories.has(accessory.UUID))
      .toArray()

    if (stale.length > 0) this.#api.unregisterPlatformAccessories(manifest.name, schema.pluginAlias, stale)
    if (fresh.length > 0) this.#api.registerPlatformAccessories(manifest.name, schema.pluginAlias, fresh)

    await schedule.start(this.#shutdown.signal)

    reading.start(this.#shutdown.signal)
  }
}
