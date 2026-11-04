import { extent, range, sum } from 'd3-array'
import { scaleLog }           from 'd3-scale'

import * as format           from './format.ts'
import { luxRange }          from './homekit.ts'
import { SampleDay, runsOf } from './sample-day.ts'
import { skyShade }          from './sky-ramp.ts'

/**
 * The curve's brightness at one altitude a panel names.
 */
interface CurveMark {
  readonly lux  : number
  readonly name : string
}

/**
 * One decade of the range `CurrentAmbientLightLevel` accepts, with the words
 * and the figures its tile and its panel show.
 */
export interface Decade {
  readonly clearSky : string
  readonly day      : string
  readonly everyday : readonly { readonly lux: string, readonly name: string }[]
  readonly fill     : string
  readonly floor    : string
  readonly ink      : string
  readonly label    : string
  readonly minutes  : number
  readonly range    : string
}

/**
 * What the Lux Scale draws.
 */
export interface DecadeScale {
  readonly date    : string
  readonly decades : readonly Decade[]
  readonly lede    : string
  readonly opening : number
}

/**
 * The rows of the Illuminance table in Wikipedia's Lux article, from the
 * darkest to the brightest, each with the one value or the span of values it
 * gives.
 */
const EVERYDAY = [
  { low: 0.0001, name: 'Moonless, overcast night sky' },
  { low: 0.002, name: 'Moonless clear night sky with airglow' },
  { low: 0.01, name: 'Quarter moon on a clear night' },
  { high: 0.3, low: 0.05, name: 'Full moon on a clear night' },
  { low: 3.4, name: 'Dark limit of civil twilight under a clear sky' },
  { high: 50, low: 20, name: 'Public areas with dark surroundings' },
  { low: 50, name: 'Family living room lights' },
  { low: 80, name: 'Office building hallway lighting' },
  { low: 100, name: 'Very dark overcast day' },
  { low: 150, name: 'Railway station platforms' },
  { high: 500, low: 320, name: 'Office lighting' },
  { low: 400, name: 'Sunrise or sunset on a clear day' },
  { low: 1000, name: 'Overcast day' },
  { high: 25_000, low: 10_000, name: 'Full daylight, not direct sun' },
  { high: 100_000, low: 32_000, name: 'Direct sunlight' }
]
const TWILIGHT_TOP = 0.1  // Degrees of altitude a decade's top stays under to count as twilight
const floor        = Math.round(Math.log10(luxRange.min))
const top          = Math.round(Math.log10(luxRange.max))
const exponents    = range(floor, top)

function altitudeAt({ sky }: SampleDay): (lux: number) => number {
  const altitudes = range(-300, 901).map((tenths) => tenths / 10)  // Degrees up to the zenith

  return scaleLog(altitudes.map((altitude) => sky.illuminance(altitude)), altitudes)
}

function curveMarks({ altitudes, sky }: SampleDay): CurveMark[] {
  return [
    { altitude: -12, name: 'nautical twilight ends' },
    { altitude: -6, name: 'civil twilight ends' },
    { altitude: -5 / 6, name: 'sunset' },
    { altitude: 10, name: 'sun at 10°' },
    { altitude: 30, name: 'sun at 30°' },
    { altitude: Math.max(...altitudes), name: 'noon on the sample day' },
    { altitude: 60, name: 'sun at 60° past the ceiling' }
  ].map(({ altitude, name }) => ({ lux: sky.illuminance(altitude), name }))
}

function decadeAt(
  day      : SampleDay,
  exponent : number,
  marks    : readonly CurveMark[],
  reach    : (lux: number) => number
): Decade {
  const low           = 10 ** exponent
  const high          = 10 ** (exponent + 1)
  const within        = (lux: number) => decadeOf(lux) === exponent
  const runs          = runsOf(day.readings.slice(0, SampleDay.MINUTES).map(within))
  const held          = runs.map(([start, end]) => runText(day, start, end))
  const minutes       = sum(runs, ([start, end]) => end - start)
  const span          = `${format.formatLux(low)} to ${format.formatLux(high)} lux`
  const { fill, ink } = skyShade((exponent - floor + 0.5) / (top - floor))
  const sun = `The sun from ${format.formatDegrees(reach(low))} to ${format.formatDegrees(reach(high))}`
  const passed        = marks.filter(({ lux }) => within(lux))
    .map(({ lux, name }) => `${name} at ${format.formatLux(lux)}`)

  return {
    clearSky : [sun, ...passed].join(', '),
    day      : `${minutes} minutes, ${format.clockListFormat.format(held)}`,
    everyday : EVERYDAY.filter(({ high, low }) => within(Math.sqrt(low * (high ?? low)))).map(everydayRow),
    fill     : fill,
    floor    : format.formatLux(low),
    ink      : ink,
    label    : `${span}, ${minutes} minutes on ${day.date}`,
    minutes  : minutes,
    range    : span
  }
}

function decadeOf(lux: number): number {
  return Math.min(Math.floor(Math.log10(lux)), top - 1)
}

function everydayRow({ high, low, name }: (typeof EVERYDAY)[number]): Decade['everyday'][number] {
  return { lux: high ? `${format.formatLux(low)} to ${format.formatLux(high)}` : format.formatLux(low), name }
}

function runText(day: SampleDay, start: number, end: number): string {
  if (start === 0) return `until ${day.clock(end)}`
  if (end === SampleDay.MINUTES) return `from ${day.clock(start)}`

  return `${day.clock(start)} to ${day.clock(end)}`
}

/**
 * Sets out each decade of the range for `day`, its share of the day, the sun's
 * altitude where the clear-sky curve reaches it, and its everyday light.
 */
export function luxScale(day: SampleDay): DecadeScale {
  const marks    = curveMarks(day)
  const reach    = altitudeAt(day)
  const decades  = exponents.map((exponent) => decadeAt(day, exponent, marks, reach))
  const twilight = decades.filter((_, index) => index > 0 && reach(10 ** (floor + index + 1)) <= TWILIGHT_TOP)
    .map(({ minutes }) => minutes)
  const [fewest, most] = extent(twilight)

  return {
    date    : day.date,
    decades : decades,
    lede    : `Each decade is one tenfold step of lux, and on ${day.date}, the reading spends hours in the `
            + `darkest and brightest steps and only **${fewest} to ${most} minutes** in each step of `
            + 'twilight.',
    opening : decadeOf(day.readings[SampleDay.NOON]!) - floor
  }
}
