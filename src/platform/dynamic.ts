import type { API, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig } from 'homebridge'

import schema                     from '../../config.schema.json' with { type: 'json' }
import manifest                   from '../../package.json' with { type: 'json' }
import { Settings }               from '../config/settings.js'
import { ClearSky }               from '../daylight/clear-sky.js'
import { Estimator }              from '../daylight/estimator.js'
import { Sun }                    from '../daylight/sun.js'
import { OUTSIDE, OutsideSensor } from '../sensor/outside.js'
import { Reading }                from '../sensor/reading.js'
import { ForecastClient }         from '../weather/client.js'
import { FetchSchedule }          from '../weather/schedule.js'
import { WindowStore }            from '../weather/store.js'

interface Collaborators {
  fetch?  : typeof fetch
  random? : (max: number) => number
}

const conjunction = new Intl.ListFormat('en', { type: 'conjunction' })

/**
 * Registers the Outside accessory for a block whose settings parse, fetches the
 * forecast for it each hour, and reads the light outdoors on it each minute. A
 * block that fails leaves the platform idle apart from one line naming the
 * settings at fault and a cached Outside marked "No Response".
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

    if (!settings.ok) {
      const keys = settings.issues.map(({ path }) => path.join('.'))

      log.warn('Outside reads nothing until the settings hold a valid %s', conjunction.format(keys))
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
    const uuid   = this.#api.hap.uuid.generate(OUTSIDE.serial)
    const cached = this.#accessories.get(uuid)

    if (this.#settings === undefined) {
      if (cached) new OutsideSensor(cached, this.#api).fail()

      return
    }

    const { fetch, random } = this.#collaborators
    const { place }         = this.#settings
    const stale             = this.#accessories.values()
      .filter((accessory) => accessory !== cached)
      .toArray()
    const accessory = cached ?? new this.#api.platformAccessory(OUTSIDE.name, uuid)
    const reading   = new Reading(
      new Estimator(new ClearSky(), new Sun(place)),
      this.#log,
      new OutsideSensor(accessory, this.#api)
    )
    const schedule = new FetchSchedule(
      new ForecastClient(fetch),
      this.#log,
      place,
      reading,
      new WindowStore(this.#api.user.storagePath()),
      random
    )

    if (stale.length > 0) this.#api.unregisterPlatformAccessories(manifest.name, schema.pluginAlias, stale)
    if (!cached) this.#api.registerPlatformAccessories(manifest.name, schema.pluginAlias, [accessory])

    await schedule.start(this.#shutdown.signal)

    reading.start(this.#shutdown.signal)
  }
}
