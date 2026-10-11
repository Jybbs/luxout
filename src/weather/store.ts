import { readFile, rename, writeFile } from 'node:fs/promises'
import { join }                        from 'node:path'

import type { Place }     from '../config/place.js'
import { ForecastWindow } from './window.js'

const FILE = 'luxout-forecast.json'

/**
 * Keeps the last forecast window in one file inside the Homebridge storage
 * directory.
 */
export class WindowStore {
  readonly #path: string

  constructor(directory: string) {
    this.#path = join(directory, FILE)
  }

  /**
   * Reads the window stored for `place`, resolving to `undefined` where the
   * file is missing, malformed, or fetched for other coordinates, and
   * rejecting on any other error.
   */
  async read(place: Place): Promise<ForecastWindow | undefined> {
    const stored: unknown = await readFile(this.#path, 'utf8')
      .then(JSON.parse)
      .catch(absent)
    const window = ForecastWindow.restore(stored)

    return window.ok && window.value.place.equals(place) ? window.value : undefined
  }

  /**
   * Writes `window` whole to a temporary file beside the stored one and moves
   * it into place, so a write that stops partway leaves the previous file.
   */
  async write(window: ForecastWindow): Promise<void> {
    const temporary = `${this.#path}.tmp`

    await writeFile(temporary, JSON.stringify(window), { flush: true })
    await rename(temporary, this.#path)
  }
}

function absent(error: unknown): undefined {
  const missing = error instanceof Error && 'code' in error && error.code === 'ENOENT'

  if (missing || error instanceof SyntaxError) return undefined

  throw error
}
