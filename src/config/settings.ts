import * as v from '@badrap/valita'

import schema                            from '../../config.schema.json' with { type: 'json' }
import { bounded }                       from './fields.js'
import { Place }                         from './place.js'
import { ThresholdEntry, ThresholdFault } from './threshold.js'

const block = v.object({
  latitude   : bounded(schema.schema.properties.latitude),
  longitude  : bounded(schema.schema.properties.longitude),
  thresholds : v.array(v.record()).optional(() => [])
})

/**
 * Holds the settings of the platform's block in `config.json`.
 */
export class Settings {
  readonly faults     : readonly ThresholdFault[]
  readonly place      : Place
  readonly thresholds : readonly ThresholdEntry[]

  /**
   * Parses the block Homebridge hands the platform, failing a latitude or a
   * longitude that is missing, not a number, or outside the bounds
   * `config.schema.json` declares for it, and a `thresholds` that is not a list
   * of objects. Every other key passes unread, among them `platform`,
   * `_bridge`, and the `name` Homebridge prefixes its log lines with.
   *
   * An entry under `thresholds` that fails, or that repeats the name an earlier
   * entry holds, leaves the block parsing and lands among the faults instead.
   */
  static parse(config: unknown): v.ValitaResult<Settings> {
    const parsed = block.try(config, { mode: 'strip' })

    if (!parsed.ok) return parsed

    const { latitude, longitude, thresholds } = parsed.value
    const claimed                             = new Set<string>()
    const entries                             = thresholds.map((raw, position) => {
      const entry = ThresholdEntry.parse(raw, position)

      if (entry.name === undefined) return entry
      if (claimed.has(entry.name)) {
        return new ThresholdFault(
          `${entry.name} starts no second sensor, since an earlier entry holds its name`
        )
      }

      claimed.add(entry.name)

      return entry
    })

    return v.ok(new Settings(
      entries.filter((entry) => entry instanceof ThresholdFault),
      new Place(latitude, longitude),
      entries.filter((entry) => entry instanceof ThresholdEntry)
    ))
  }

  private constructor(
    faults     : readonly ThresholdFault[],
    place      : Place,
    thresholds : readonly ThresholdEntry[]
  ) {
    this.faults     = faults
    this.place      = place
    this.thresholds = thresholds
  }
}
