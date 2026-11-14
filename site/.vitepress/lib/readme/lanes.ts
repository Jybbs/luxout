import { bisectRight, bisector, max } from 'd3-array'

import { ThresholdEntry }              from '../../../../src/config/threshold.ts'
import { type CloudStep, cloudSteps } from '../daylight/cloud-steps.ts'
import { SampleDay, runsOf }           from '../daylight/sample-day.ts'

/**
 * One 15-minute step of the forecast as the lane draws it, its sunlight at the
 * ground in W/m² beside the factor it gives.
 */
interface ForecastStep extends Pick<CloudStep, 'clear' | 'clock' | 'forecast'> {
  readonly borrowed : number | undefined  // The count of daylight steps whose mean factor the step takes
  readonly factor   : number
  readonly minute   : number
  readonly share    : number  // The step's sunlight over the day's highest
}

const byMinute = bisector((step: ForecastStep) => step.minute)

/**
 * The threshold sensor Dark Out the preview runs across the sample day, at the
 * levels `config.schema.json` shows as placeholders, which switch it on as the
 * light falls.
 */
export class DarkOut {
  readonly entry    : ThresholdEntry
  readonly states   : readonly boolean[]  // Whether the sensor is on at each minute from midnight
  readonly switches : readonly number[]   // The minutes past midnight at which the sensor switches

  constructor(day: SampleDay) {
    const entry = ThresholdEntry.parse({ name: 'Dark Out' }, 0)

    if (!(entry instanceof ThresholdEntry)) throw new Error(entry.line)

    let on = false

    this.entry    = entry
    this.states   = day.readings.map((lux) => on = entry.detects(on, lux))
    this.switches = runsOf(this.states).flat().filter((minute) => minute > 0 && minute < this.states.length)
  }

  /**
   * Counts the switches the sensor makes from midnight through `minute`.
   */
  countBy(minute: number): number {
    return bisectRight(this.switches, minute)
  }

  /**
   * Finds each span the sensor is on from midnight through `minute`.
   */
  spansBy(minute: number): ReturnType<typeof runsOf> {
    return runsOf(this.states.slice(0, minute + 1)).map(([start, end]) => [start, Math.min(end, minute)])
  }
}

/**
 * The forecast's 15-minute steps of sunlight on the sample day, each beside the
 * share of a clear sky's sunlight it gives.
 */
export class ForecastSteps {
  readonly steps    : readonly ForecastStep[]
  readonly #covered : SampleDay['steps']

  constructor(day: SampleDay) {
    const { cloud, window } = day
    const highest           = max(window.irradiances)!
    const drawn             = cloudSteps(day).steps

    this.#covered = day.steps
    this.steps    = cloud.steps.map(({ factor, time }, index) => {
      const { borrowed, clear, clock, forecast } = drawn[index]!

      return {
        borrowed : borrowed ? cloud.nearest(time).length : undefined,
        clear    : clear,
        clock    : clock,
        factor   : factor,
        forecast : forecast,
        minute   : day.minuteOf(time),
        share    : window.irradiances[index]! / highest
      }
    })
  }

  /**
   * Finds the step in use at `minute`, the latest one at or before it while
   * the forecast covers the minute.
   *
   * Returns:
   *   The step, or `undefined` where no step covers `minute`.
   */
  at(minute: number): ForecastStep | undefined {
    const covered = this.#covered[minute] !== undefined

    return covered ? this.steps[byMinute.right(this.steps, minute) - 1] : undefined
  }
}
