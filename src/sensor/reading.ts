import { Cron }         from 'croner'
import type { Logging } from 'homebridge'

import type { CloudFactor }     from '../daylight/cloud-factor.js'
import type { Estimator }       from '../daylight/estimator.js'
import type { ForecastWindow }  from '../weather/window.js'
import { figure }               from './figure.js'
import type { OutsideSensor }   from './outside.js'
import type { ThresholdSensor } from './threshold.js'

/**
 * Reads the outdoor illuminance at launch and each minute after, shows it on
 * the Outside sensor, compares it against each threshold sensor's levels, and
 * logs every value behind it at debug level.
 */
export class Reading {
  readonly #estimator  : Estimator
  #factor              : CloudFactor | undefined
  #fallback            : boolean
  readonly #log        : Logging
  readonly #sensor     : OutsideSensor
  readonly #thresholds : readonly ThresholdSensor[]

  constructor(
    estimator  : Estimator,
    log        : Logging,
    sensor     : OutsideSensor,
    thresholds : readonly ThresholdSensor[] = []
  ) {
    this.#estimator  = estimator
    this.#fallback   = false
    this.#log        = log
    this.#sensor     = sensor
    this.#thresholds = thresholds
  }

  /**
   * Reads now and at the start of each minute after until `signal` aborts, and
   * reads nothing where it has already aborted.
   */
  start(signal: AbortSignal): void {
    if (signal.aborted) return

    this.#read()

    const job = new Cron('0 * * * * *', { utcOffset: 0 }, () => this.#read())

    signal.addEventListener('abort', () => job.stop(), { once: true })
  }

  /**
   * Derives the cloud factor of every later reading from `window`, carrying the
   * daylight steps of the factor it replaces.
   */
  use(window: ForecastWindow): void {
    this.#factor = this.#estimator.derive(window, this.#factor)
  }

  #read(): void {
    try {
      const estimate = this.#estimator.estimate(new Date(), this.#factor)
      const shown    = this.#sensor.report(estimate.lux)
      const lux      = figure.format(shown)
      const altitude = figure.format(estimate.altitude)
      const clearSky = figure.format(estimate.clearSky)
      const fallback = estimate.steps === undefined

      if (fallback) {
        if (!this.#fallback) {
          this.#log.warn('Outside reads the clear sky alone until a forecast covers the present')
        }

        this.#log.debug(
            'Outside reads %s lux from a solar altitude of %s°, a clear-sky illuminance of %s lux, '
          + 'and a cloud factor of %s, since no forecast covers the minute',
          lux,
          altitude,
          clearSky,
          figure.format(estimate.factor)
        )
      } else {
        const [before, after] = estimate.steps

        this.#log.debug(
            'Outside reads %s lux from a solar altitude of %s°, a clear-sky illuminance of %s lux, '
          + 'and a cloud factor of %s interpolated between %s at %s and %s at %s',
          lux,
          altitude,
          clearSky,
          figure.format(estimate.factor),
          figure.format(before.factor),
          new Date(before.time).toISOString(),
          figure.format(after.factor),
          new Date(after.time).toISOString()
        )
      }

      this.#fallback = fallback

      for (const threshold of this.#thresholds) threshold.compare(shown)
    } catch (error) {
      this.#log.error('Outside could not read the light outdoors: %s', error)
    }
  }
}
