import { range, sort } from 'd3-array'
import { scaleLinear } from 'd3-scale'

import { CLOUD_TUNING, haurwitz }     from '../../../../src/daylight/cloud-factor.ts'
import { HOUR_MINUTES, STEP_MINUTES } from './clock.ts'
import * as format                    from './format.ts'
import { SampleDay }                  from './sample-day.ts'
import { tenth }                      from './tenth.ts'

/**
 * One 15-minute step of the forecast, with the words and the bars it opens.
 */
interface CloudStep {
  readonly bars     : { readonly clear: number, readonly forecast: number }
  readonly borrowed : boolean
  readonly clear    : string
  readonly clock    : string
  readonly drawn    : string
  readonly forecast : string
  readonly how      : string
  readonly lead     : string
  readonly share    : string
  readonly sum      : string
  readonly text     : string
  readonly top      : number
}

/**
 * What The Cloud Factor draws, each strip height down from the strip's top and
 * each strip width out of the plot's width.
 */
export interface CloudSteps {
  readonly floor : number
  readonly hours : readonly { readonly word: string, readonly x: number }[]
  readonly opens : number
  readonly steps : readonly CloudStep[]
  readonly strip : {
    readonly axis   : number
    readonly bar    : number
    readonly full   : number
    readonly height : number
    readonly pitch  : number
    readonly width  : number
  }
}

/**
 * The arithmetic one step's factor comes from, and the words that state it.
 */
interface StepWords {
  readonly how  : string
  readonly lead : string
  readonly sum  : string
}

const AXIS    = 28    // The height of the strip's axis
const BAR     = 0.56  // The share of a step's width its bar takes
const FULL    = 6     // The height of a share of 1
const HEIGHT  = 44    // The height of the strip
const WIDTH   = 1000  // The width the strip is drawn in
const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0, style: 'percent' })

function borrowedWords(clock: string, day: SampleDay, factor: number, sun: string, time: number): StepWords {
  const near  = sort(day.cloud.nearest(time), (step) => step.time)
  const terms = near.map((step) => format.formatFactor(step.factor)).join(' + ')
  const whole = format.listFormat.format(near.map(({ time }) => day.clockAt(time)))

  return {
    how  : `At ${clock}, the sun stands ${sun} once refracted, too low for the comparison to carry signal, `
         + `so the step takes the mean of the steps at ${whole}.`,
    lead : ` at ${clock}, borrowed from the morning’s first daylight hour, since the sun is under `
         + `${CLOUD_TUNING.floor}°.`,
    sum  : `(${terms}) ÷ ${near.length} = ${format.formatFactor(factor)}`
  }
}

function heldWords(clear: string, clock: string, forecast: string, ratio: number, sun: string): StepWords {
  return {
    how  : `Open-Meteo’s sunlight over the Haurwitz clear sky at ${sun}, each in W/m², held at 1 so a `
         + 'cloud’s bright edge never reads above a clear sky.',
    lead : ` at ${clock}, where the forecast runs slightly past a clear sky and the share holds at 1.`,
    sum  : `${forecast} ÷ ${clear} = ${format.formatFactor(ratio)}, held at 1`
  }
}

function plainWords(clear: string, clock: string, factor: number, forecast: string, sun: string): StepWords {
  return {
    how  : `Open-Meteo’s sunlight at the ground over the Haurwitz clear sky at ${sun}, each in W/m².`,
    lead : ` of a clear sky’s sunlight gets through the clouds at ${clock}.`,
    sum  : `${forecast} ÷ ${clear} = ${format.formatFactor(factor)}`
  }
}

/**
 * Writes each step of the forecast `day` holds as the share of a clear sky's
 * sunlight the clouds let through, beside the division or the mean it comes
 * from. A clear sky's sunlight reads 0 below the horizon, where the Haurwitz
 * model turns negative.
 */
export function cloudSteps(day: SampleDay): CloudSteps {
  const { cloud, window } = day
  const [from, to]        = day.span

  const pitch = WIDTH / window.times.length
  const top   = scaleLinear([0, 1], [AXIS, FULL])

  return {
    floor : CLOUD_TUNING.floor,
    opens : window.times.findIndex((time) => day.minuteOf(time) === SampleDay.REST),
    strip : { axis: AXIS, bar: tenth(pitch * BAR), full: FULL, height: HEIGHT, pitch, width: WIDTH },

    hours: range(Math.ceil(from / HOUR_MINUTES) * HOUR_MINUTES, to + 1, HOUR_MINUTES).map((minute) => ({
      word : day.clock(minute),
      x    : tenth(pitch * ((minute - from) / STEP_MINUTES + 0.5))
    })),

    steps: cloud.steps.map(({ factor, time }, index) => {
      const refracted = day.refractedAt(time)
      const clear     = Math.max(haurwitz(refracted), 0)
      const forecast  = window.irradiances[index]!
      const clock     = day.clockAt(time)
      const borrowed  = !day.litAt(time)
      const held      = !borrowed && forecast > clear
      const scale     = Math.max(clear, forecast) || 1
      const figures   = { clear: clear.toFixed(1), forecast: forecast.toFixed(1) }
      const degrees   = format.formatDegrees(refracted)
      const share     = percent.format(factor)
      const words     = borrowed ? borrowedWords(clock, day, factor, degrees, time)
                      : held ? heldWords(figures.clear, clock, figures.forecast, forecast / clear, degrees)
                      : plainWords(figures.clear, clock, factor, figures.forecast, degrees)

      return {
        ...words,
        bars     : { clear: tenth(clear / scale * 100), forecast: tenth(forecast / scale * 100) },
        borrowed : borrowed,
        clear    : `${figures.clear} W/m²`,
        clock    : clock,
        drawn    : `At ${clock}, a clear sky’s ${figures.clear} W/m² against the forecast’s `
                 + `${figures.forecast} W/m²`,
        forecast : `${figures.forecast} W/m²`,
        share    : share,
        text     : `${clock}, ${share} of a clear sky’s sunlight${borrowed ? ', borrowed' : ''}`,
        top      : tenth(top(factor))
      }
    })
  }
}
