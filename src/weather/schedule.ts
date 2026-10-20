import { randomInt } from 'node:crypto'

import { Cron }         from 'croner'
import type { Logging } from 'homebridge'

import type { Place }          from '../config/place.js'
import type { Reading }        from '../sensor/reading.js'
import type { ForecastClient } from './client.js'
import { FetchFailure }        from './failure.js'
import type { WindowStore }    from './store.js'

type Tuning = typeof TUNING

const TUNING = { retry: 60_000 }  // The milliseconds a failed fetch waits before its first retry

/**
 * Fetches the forecast for a place each hour, at a second and a minute drawn
 * once. It retries a failed fetch after a wait that starts at the tuning's
 * `retry` and doubles, scheduling no retry at or past the next hourly fetch.
 * Each window that arrives replaces the one the reading and the store hold.
 */
export class FetchSchedule {
  readonly #client  : ForecastClient
  readonly #fail    : (error: unknown) => void
  readonly #hourly  : Cron
  readonly #log     : Logging
  readonly #place   : Place
  readonly #reading : Pick<Reading, 'use'>
  #retry            : Cron | undefined
  readonly #store   : WindowStore
  readonly #tuning  : Tuning

  constructor(
    client  : ForecastClient,
    log     : Logging,
    place   : Place,
    reading : Pick<Reading, 'use'>,
    store   : WindowStore,
    random  : (max: number) => number = randomInt,
    tuning  : Tuning                  = TUNING
  ) {
    this.#client = client
    this.#fail   = (error: unknown) => log.error('Outside could not refresh the forecast: %s', error)
    this.#hourly = new Cron(`${random(60)} ${random(60)} * * * *`, {
      catch     : this.#fail,
      protect   : true,
      utcOffset : 0
    })
    this.#log     = log
    this.#place   = place
    this.#reading = reading
    this.#store   = store
    this.#tuning  = tuning
  }

  /**
   * Hands the reading the window the store holds and fetches at once unless
   * that window covers the present through the first hourly fetch, settling
   * once that fetch settles. It then fetches each hour until `signal` aborts,
   * which stops every job and aborts the request in flight.
   */
  async start(signal: AbortSignal): Promise<void> {
    const window = await this.#store.read(this.#place).catch((error: unknown) => {
      this.#log.warn('Outside reads no stored forecast, since reading it failed: %s', error)
    })
    const first = this.#tuning.retry

    if (signal.aborted) return

    signal.addEventListener('abort', () => this.#stop(), { once: true })

    if (window) this.#reading.use(window)

    const held = [new Date(), ...this.#hourly.nextRuns(1)].every((instant) => window?.covers(instant))

    if (!held) await this.#fetch(signal, first).catch(this.#fail)

    this.#hourly.schedule(() => this.#retry?.isBusy() ? undefined : this.#fetch(signal, first))
  }

  async #fetch(signal: AbortSignal, wait: number): Promise<void> {
    const outcome = await this.#client.fetch(this.#place, signal)

    if (outcome === undefined) return

    this.#retry?.stop()

    if (outcome instanceof FetchFailure) {
      this.#log.warn(outcome.line)

      if (wait < (this.#hourly.msToNext() ?? 0)) {
        this.#retry = new Cron(
          new Date(Date.now() + wait),
          { catch: this.#fail, utcOffset: 0 },
          () => this.#fetch(signal, 2 * wait)
        )
      }

      return
    }

    this.#reading.use(outcome)

    await this.#store.write(outcome).catch((error: unknown) => {
      this.#log.warn(
        'Outside keeps the forecast it fetched in memory alone, since storing it failed: %s',
        error
      )
    })
  }

  #stop(): void {
    this.#hourly.stop()
    this.#retry?.stop()
  }
}
