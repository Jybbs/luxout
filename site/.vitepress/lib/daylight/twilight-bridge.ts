import { range, sort }           from 'd3-array'
import { scaleLinear, scaleLog } from 'd3-scale'
import { area, line }            from 'd3-shape'

import { BRIDGE_SPAN, type ClearSky } from '../../../../src/daylight/clear-sky.ts'
import { formatLux, signed }          from './format.ts'
import * as curve                     from './sun-curve.ts'
import { tenth }                      from './tenth.ts'

/**
 * A mark on the drawing's two scales, in the units of its `viewBox`.
 */
interface BridgeEnd {
  readonly word : string
  readonly x    : number
  readonly y    : number
}

/**
 * A word set against one of the drawing's scales, with `at` the place along it.
 */
interface BridgeTick {
  readonly at     : number
  readonly word   : string
  readonly minor? : boolean
}

/**
 * The clear-sky curve The Twilight Bridge draws, on a logarithmic lux scale
 * with the span up to the refraction cutoff marked, and the stops the sun takes
 * along it, one each tenth of a degree and one at the cutoff.
 */
export interface TwilightBridge {
  readonly area    : string
  readonly axis    : string
  readonly cut     : number  // The stop at the refraction cutoff
  readonly decades : readonly BridgeTick[]
  readonly degrees : readonly string[]
  readonly edge    : string
  readonly figures : readonly string[]
  readonly grid    : string
  readonly height  : number
  readonly high    : BridgeEnd
  readonly label   : string
  readonly low     : BridgeEnd
  readonly minor   : string
  readonly phrases : readonly [string, string, string]
  readonly rest    : number
  readonly ticks   : readonly BridgeTick[]
  readonly width   : number
  readonly x       : readonly number[]
  readonly y       : readonly number[]
}

const DECADES = [1, 10, 100, 1000, 10_000]  // Lux
const FLOOR   = BRIDGE_SPAN[0]
const HEIGHT  = 260
const LOW_SUN = 12  // Degrees
const RESTING = -3  // Degrees
const TENTHS  = 10  // The stops in one degree
const TICK    = 4   // The length of a tick
const TOP_LUX = 30_000
const WIDTH   = 540
const TICKS   = [
  { at: FLOOR },
  { at: curve.SUNSET },
  { at: 3, minor: true },
  { at: 6 },
  { at: 9, minor: true },
  { at: LOW_SUN }
]

function tickMarks(ticks: readonly BridgeTick[]): string {
  return ticks.map(({ at }) => `M${at} ${HEIGHT}v${TICK}`).join('')
}

function tickWord(altitude: number): string {
  return altitude === curve.SUNSET ? curve.SUNSET_WORD : `${signed(altitude)}°`
}

/**
 * Lays the curve `sky` draws between `FLOOR` and `LOW_SUN` degrees across the
 * drawing's coordinates, and writes each stop's altitude and lux.
 */
export function twilightBridge(sky: ClearSky): TwilightBridge {
  const x       = scaleLinear([FLOOR, LOW_SUN], [0, WIDTH])
  const y       = scaleLog([1, TOP_LUX], [HEIGHT, 0])
  const top     = (altitude: number) => y(sky.illuminance(altitude))
  const luxWord = (altitude: number) => `${formatLux(sky.illuminance(altitude))} lux`
  const tenths  = range(FLOOR * TENTHS, LOW_SUN * TENTHS + 1).map((step) => step / TENTHS)
  const stops   = sort([...tenths, curve.SUNSET])
  const ticks   = TICKS.map(({ at, minor }) => ({ at: tenth(x(at)), minor, word: tickWord(at) }))
  const endAt   = (altitude: number) => ({
    word : luxWord(altitude),
    x    : tenth(x(altitude)),
    y    : tenth(top(altitude))
  })

  const high = endAt(curve.SUNSET)
  const low  = endAt(FLOOR)

  return {
    area    : area<number>().digits(1).x(x).y0(HEIGHT).y1(top)(stops)!,
    axis    : `M0 ${HEIGHT}H${WIDTH}${tickMarks(ticks.filter(({ minor }) => !minor))}`,
    cut     : stops.indexOf(curve.SUNSET),
    decades : DECADES.map((lux) => ({ at: tenth(y(lux)), word: formatLux(lux) })),
    degrees : stops.map(curve.altitudeWord),
    edge    : line<number>().digits(1).x(x).y(top)(stops)!,
    figures : stops.map(luxWord),
    grid    : DECADES.map((lux) => `M0 ${tenth(y(lux))}H${WIDTH}`).join(''),
    height  : HEIGHT,
    high    : high,
    label   : `The clear-sky curve from ${tickWord(FLOOR)} to ${tickWord(LOW_SUN)} on a `
            + `logarithmic lux scale, climbing from ${low.word} to ${high.word} across the span up to `
            + `${curve.SUNSET_WORD} and through that cutoff without a step, with a slider that moves the `
            + 'sun along it.',
    low     : low,
    minor   : tickMarks(ticks.filter(({ minor }) => minor)),
    rest    : stops.indexOf(RESTING),
    ticks   : ticks,
    width   : WIDTH,
    x       : stops.map((altitude) => tenth(x(altitude))),
    y       : stops.map((altitude) => tenth(top(altitude))),
    phrases : [
      'Inside the span, where the logarithm of the lux runs straight against the altitude',
      'At the cutoff, where the span ends on the circular’s own value',
      'Past the cutoff, on the circular’s own values'
    ]
  }
}
