import * as v from '@badrap/valita'

import schema    from '../../config.schema.json' with { type: 'json' }
import { Place } from './place.js'

const block = v.object({
  latitude  : bounded(schema.schema.properties.latitude),
  longitude : bounded(schema.schema.properties.longitude),
  name      : v.string().optional()
})
  .map(({ latitude, longitude }) => new Place(latitude, longitude))

/**
 * Holds the settings of the platform's block in `config.json`.
 */
export class Settings {
  readonly place: Place

  /**
   * Parses the block Homebridge hands the platform, failing a number outside
   * the bounds `config.schema.json` declares for it. The `platform` and
   * `_bridge` keys Homebridge adds pass, as does the `name` only Homebridge
   * reads.
   */
  static parse(config: unknown): v.ValitaResult<Settings> {
    const place = block.try(config, { mode: 'strip' })

    return place.ok ? v.ok(new Settings(place.value)) : place
  }

  private constructor(place: Place) {
    this.place = place
  }
}

function bounded({ maximum, minimum }: { maximum: number, minimum: number }): v.Type<number> {
  return v.number().assert((value) => minimum <= value && value <= maximum)
}
