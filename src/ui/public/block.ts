import type { PluginConfig } from '@homebridge/plugin-ui-utils/ui.interface'

import { type Coordinates, Match } from './match.js'

/**
 * Holds the plugin's block as the Homebridge UI last reported it, every key the
 * generated form writes among them, so a change the page makes writes back the
 * whole block rather than the keys the page owns.
 */
export class PluginBlock {
  readonly #block: PluginConfig

  /**
   * Takes the first of the blocks the Homebridge UI reports, or a new block on
   * the platform `alias` names where the plugin has none yet.
   */
  static from(alias: string, blocks: PluginConfig[]): PluginBlock {
    return new PluginBlock(blocks[0] ?? { platform: alias })
  }

  private constructor(block: PluginConfig) {
    this.#block = block
  }

  get blocks(): PluginConfig[] {
    return [this.#block]
  }

  /**
   * Reads the latitude and the longitude the block keeps, where both are
   * numbers.
   */
  get coordinates(): Coordinates | undefined {
    const { latitude, longitude } = this.#block

    return typeof latitude === 'number' && typeof longitude === 'number' ? { latitude, longitude } : undefined
  }

  /**
   * Reads the confirmed match the block keeps, from the name, region, and
   * country under `place` and the coordinates beside them.
   */
  get match(): Match | undefined {
    const { coordinates } = this
    const { place }       = this.#block

    return coordinates && typeof place?.name === 'string'
         ? new Match(place.name, coordinates, place.country, place.region)
         : undefined
  }

  /**
   * Builds a copy of the block keeping `coordinates`, with the name, the
   * region, and the country of `match` under `place`, or with `place` cleared
   * where no match named them. A cleared key is sent as `undefined`, since the
   * Homebridge UI merges each block into the one it holds and leaves a missing
   * key there.
   */
  located(coordinates: Coordinates, match?: Match): PluginBlock {
    const place = match && { country: match.country, name: match.name, region: match.region }

    return new PluginBlock({ ...this.#block, ...coordinates, place })
  }
}
