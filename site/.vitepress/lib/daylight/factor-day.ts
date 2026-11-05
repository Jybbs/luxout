import { max, range }            from 'd3-array'
import { scaleLinear, scaleLog } from 'd3-scale'
import { area, line }            from 'd3-shape'

import * as format   from './format.ts'
import { luxRange }  from './homekit.ts'
import { SampleDay } from './sample-day.ts'
import { tenth }     from './tenth.ts'

/**
 * The clear-sky curve against the sun's altitude, with the position of the
 * minute's dot, `undefined` where the sun sits below the altitudes drawn.
 */
interface CurvePlot {
  readonly area    : string
  readonly ceiling : number
  readonly edge    : string
  readonly ticks   : readonly PlotWord[]
  readonly x       : readonly (number | undefined)[]
  readonly y       : readonly number[]
}

/**
 * What The Three Factors draws.
 */
export interface FactorDay {
  readonly axis    : number
  readonly curve   : CurvePlot
  readonly factor  : FactorPlot
  readonly height  : number
  readonly minutes : readonly string[]
  readonly outside : readonly boolean[]
  readonly range   : RangePlot
  readonly rest    : number
  readonly terms   : readonly [FactorTerm, FactorTerm, FactorTerm]
  readonly track   : { readonly from: number, readonly to: number }
  readonly upper   : number
  readonly width   : number
}

/**
 * The cloud factor across the forecast window, with the position of the
 * minute's dot and each step's mark.
 */
interface FactorPlot {
  readonly fall   : string
  readonly grid   : number
  readonly line   : string
  readonly steps  : readonly { readonly low: boolean, readonly x: number, readonly y: number }[]
  readonly window : readonly [PlotWord, PlotWord]
  readonly x      : readonly number[]
  readonly y      : readonly number[]
  readonly yWords : readonly { readonly word: string, readonly y: number }[]
}

/**
 * One term of the line, with its figure and its source at each minute.
 */
interface FactorTerm {
  readonly figures : readonly string[]
  readonly label   : string
  readonly name    : string
  readonly note    : string
  readonly sources : readonly string[]
  readonly unit    : string
}

/**
 * A word set along a plot, at `x` of the width of 1000 every plot is drawn in.
 */
interface PlotWord {
  readonly word : string
  readonly x    : number
}

/**
 * HomeKit's range as a line, with the positions of the clear sky and the
 * reading at each minute, the clear sky `undefined` where it sits under the
 * range.
 */
interface RangePlot {
  readonly axis    : string
  readonly clear   : readonly (number | undefined)[]
  readonly ends    : readonly [string, string]
  readonly reading : readonly number[]
}

const ALTITUDES = [-20, 65] as const   // The sun's altitudes in degrees the curve covers
const AXIS      = 90                   // The height of each plot's axis, down from its top
const GRID      = 0.8                  // The factor the plot's grid line marks
const HEIGHT    = 108                  // The height of each plot
const LUX       = [luxRange.min, 2e5]  // The lux the curve's axis covers
const SHARES    = [0.6, 1.05]          // The factors the factor's axis covers
const TOP       = 6                    // The height of the curve's top, down from the plot's top
const UPPER     = 70                   // The height of the clear sky's dot over HomeKit's range
const WIDTH     = 1000                 // The width every plot is drawn in

function curvePlot({ altitudes, clearSkies, sky }: SampleDay): CurvePlot {
  const shown  = altitudes.slice(0, SampleDay.MINUTES)
  const x      = scaleLinear(ALTITUDES, [0, WIDTH])
  const y      = scaleLog(LUX, [AXIS, TOP]).clamp(true)
  const degree = range(ALTITUDES[0], ALTITUDES[1] + 0.01, 0.5)
  const top    = (altitude: number) => y(sky.illuminance(altitude))

  return {
    area    : area<number>().digits(1).x(x).y0(AXIS).y1(top)(degree)!,
    ceiling : tenth(y(luxRange.max)),
    edge    : line<number>().defined((altitude) => top(altitude) < AXIS).digits(1).x(x).y(top)(degree)!,
    ticks   : [0, 30, 60].map((altitude) => ({ word: `${altitude}°`, x: tenth(x(altitude)) })),
    x       : shown.map((altitude) => altitude < ALTITUDES[0] ? undefined : tenth(x(altitude))),
    y       : clearSkies.slice(0, SampleDay.MINUTES).map((lux) => tenth(y(lux)))
  }
}

function factorPlot(day: SampleDay): FactorPlot {
  const [from, to] = day.span
  const x          = scaleLinear([from - 30, to + 30], [0, WIDTH]).clamp(true)
  const y          = scaleLinear(SHARES, [AXIS, 8])
  const { steps }  = day.cloud
  const at         = (minute: number) => tenth(x(minute))
  const stepAt     = ({ time }: { time: number }) => x(day.minuteOf(time))
  const one        = tenth(y(1))

  return {
    fall   : `M0 ${one}H${at(from)}M${at(to)} ${one}H${WIDTH}`,
    grid   : tenth(y(GRID)),
    line   : line<(typeof steps)[number]>().digits(1).x(stepAt).y(({ factor }) => y(factor))(steps)!,
    window : [{ word: day.clock(from), x: at(from) }, { word: day.clock(to), x: at(to) }],
    x      : range(SampleDay.MINUTES).map(at),
    y      : day.factors.slice(0, SampleDay.MINUTES).map((factor) => tenth(y(factor))),
    yWords : [1, GRID].map((factor) => ({ word: String(factor), y: tenth(y(factor)) })),
    steps  : steps.map(({ factor, time }) => ({
      low : !day.litAt(time),
      x   : at(day.minuteOf(time)),
      y   : tenth(y(factor))
    }))
  }
}

function rangePlot({ clearSkies, readings }: SampleDay): RangePlot {
  const x      = scaleLog([luxRange.min, luxRange.max], [0, WIDTH]).clamp(true)
  const ticks  = x.ticks(9).map((lux) => `M${tenth(x(lux))} ${AXIS - 3}V${AXIS + 3}`)
  const clears = clearSkies.slice(0, SampleDay.MINUTES)

  return {
    axis    : `M0 ${AXIS}H${WIDTH}${ticks.join('')}`,
    clear   : clears.map((lux) => lux < luxRange.min ? undefined : tenth(x(lux))),
    ends    : [format.formatLux(luxRange.min), format.formatLux(luxRange.max)],
    reading : readings.slice(0, SampleDay.MINUTES).map((lux) => tenth(x(lux)))
  }
}

/**
 * Writes the three terms of each minute of `day`, each at the precision its
 * quantity holds, beside the plot each term opens.
 */
export function factorDay(day: SampleDay): FactorDay {
  const { altitudes, clearSkies, factors, readings, steps } = day

  const minutes = range(SampleDay.MINUTES)
  const clocks  = minutes.map((minute) => day.clock(minute))
  const between = minutes.map((minute) => {
    const around = steps[minute]?.map(({ time }) => day.clockAt(time))

    return around ? `Between ${around[0]} and ${around[1]}` : `No window covers ${clocks[minute]}`
  })
  const [from, to] = day.span
  const span       = `${format.formatLux(luxRange.min)} to ${format.formatLux(luxRange.max)}`

  return {
    axis    : AXIS,
    curve   : curvePlot(day),
    factor  : factorPlot(day),
    height  : HEIGHT,
    minutes : clocks,
    outside : minutes.map((minute) => steps[minute] === undefined),
    range   : rangePlot(day),
    rest    : SampleDay.REST,
    track   : { from: tenth(from / SampleDay.MINUTES * 100), to: tenth(to / SampleDay.MINUTES * 100) },
    upper   : UPPER,
    width   : WIDTH,
    terms   : [
      {
        figures : minutes.map((minute) => format.formatLux(clearSkies[minute]!)),
        label   : 'Circular 171’s clear-sky lux against the sun’s altitude, the minute’s altitude marked',
        name    : 'Clear sky',
        note    : 'Circular 171 gives the clear sky’s lux from the sun’s altitude alone, and the sample '
                + `day’s sun peaks at ${format.formatDegrees(max(altitudes)!)}.`,
        sources : minutes.map((minute) => `The sun at ${format.formatDegrees(altitudes[minute]!)}`),
        unit    : 'lux'
      },
      {
        figures : minutes.map((minute) => format.formatFactor(factors[minute]!)),
        label   : 'The cloud factor across the forecast window, the minute marked',
        name    : 'Cloud factor',
        note    : 'Each 15-minute step divides the forecast’s sunlight by a clear sky’s, and a minute takes '
                + 'the factor on the line between its two steps, or 1 where no stored window covers it.',
        sources : between,
        unit    : ''
      },
      {
        figures : minutes.map((minute) => format.formatLux(readings[minute]!)),
        label   : `HomeKit’s range from ${span} lux, the clear sky above it and the reading on it`,
        name    : 'Reading',
        note    : `HomeKit accepts ${span} lux, so the plugin clamps the clear sky times the factor into `
                + 'that range before writing it.',
        sources : minutes.map((minute) => heldWord(clearSkies[minute]! * factors[minute]!)),
        unit    : 'lux'
      }
    ]
  }
}

/**
 * Writes where HomeKit's range leaves a reading of `lux`.
 */
export function heldWord(lux: number): string {
  if (lux < luxRange.min) return 'Lifted to HomeKit’s floor'
  if (lux > luxRange.max) return 'Held at HomeKit’s ceiling'

  return 'Inside HomeKit’s range'
}
