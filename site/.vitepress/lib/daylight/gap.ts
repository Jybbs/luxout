import { bisectRight, minIndex } from 'd3-array'
import { scaleLinear }           from 'd3-scale'
import { line }                  from 'd3-shape'

import { ThresholdEntry }             from '../../../../src/config/threshold.ts'
import { clockListFormat, formatLux } from './format.ts'
import { SampleDay, runsOf }          from './sample-day.ts'
import { tenth }                      from './tenth.ts'

/**
 * What the gap's drawing and its table show.
 */
export interface Gap {
  readonly direction : string
  readonly label     : string
  readonly layouts   : readonly GapLayout[]
  readonly minutes   : readonly GapMinute[]
  readonly noon      : number
  readonly rest      : number
  readonly sensors   : readonly [GapSensor, GapSensor]
  readonly span      : readonly [string, string]
}

/**
 * What one sensor does at one minute, as the table beneath the lanes shows it.
 */
export interface GapCell {
  readonly count : string
  readonly mark  : 'off' | 'on' | 'ring'
  readonly word  : string
}

/**
 * One sensor's lane at one layout's coordinates.
 */
export interface GapLane {
  readonly bottom : number
  readonly chip   : number
  readonly rings  : readonly number[]
  readonly spans  : readonly { readonly width: number, readonly x: number }[]
  readonly top    : number
}

/**
 * The drawing's coordinates at one width, each rounded to a tenth.
 */
export interface GapLayout {
  readonly big    : number
  readonly guide  : string
  readonly height : number
  readonly lanes  : readonly GapLane[]
  readonly left   : number
  readonly levelX : number
  readonly offY   : number
  readonly onY    : number
  readonly path   : string
  readonly right  : number
  readonly ties   : readonly string[]
  readonly width  : number
  readonly x      : readonly number[]
  readonly y      : readonly number[]
}

/**
 * One minute a reader can point to.
 */
export interface GapMinute {
  readonly cells   : readonly GapCell[]
  readonly clock   : string
  readonly lux     : string
  readonly reading : string
  readonly spoken  : string
}

/**
 * One of the two sensors the drawing sets side by side.
 */
export interface GapSensor {
  readonly label    : string
  readonly name     : string
  readonly offBelow : string
  readonly onAt     : string
  readonly switches : number
  readonly times    : readonly string[]
  readonly unit     : string
}

const FROM    = 675  // 11:15, in minutes from midnight
const LAYOUTS = [
  { big: 32, margin: 84, plot: 118, width: 360 },
  { big: 32, margin: 84, plot: 118, width: 500 },
  { big: 36, margin: 112, plot: 134, width: 620 }
]
const LEFT       = 34
const LUX_DOMAIN = [66_000, 77_000]
const OFF_LUX    = 70_000
const ON_LUX     = 74_000
const TO         = 780  // 13:00, in minutes from midnight
const TOP        = 14

/**
 * Holds one sensor's state at each minute of the sample day, with its switches
 * and its spans on inside the late morning the drawing covers.
 */
class SensorRun {
  readonly spans    : ReturnType<typeof runsOf>
  readonly switches : readonly number[]
  readonly #day     : SampleDay
  readonly #entry   : ThresholdEntry
  readonly #states  : readonly boolean[]

  constructor(day: SampleDay, entry: ThresholdEntry) {
    let on       = false
    const states = day.readings.slice(0, TO + 1).map((lux) => on = entry.detects(on, lux))

    this.#day     = day
    this.#entry   = entry
    this.#states  = states
    this.spans    = runsOf(states.slice(FROM, TO)).map(([start, end]) => [start + FROM, end + FROM] as const)
    this.switches = runsOf(states)
      .flat()
      .filter((minute) => minute >= FROM && minute <= TO)
  }

  get sensor(): GapSensor {
    const { name, offLux, onLux } = this.#entry
    const count                   = this.switches.length
    const held = this.spans.map(([start, end]) => `from ${this.#day.clock(start)} to ${this.#day.clock(end)}`)

    return {
      label    : `${name}, the sensor is on ${clockListFormat.format(held)}, switching ${times(count)}`,
      name     : name,
      offBelow : formatLux(offLux),
      onAt     : formatLux(onLux),
      switches : count,
      times    : this.switches.map((minute) => this.#day.clock(minute)),
      unit     : unit(count)
    }
  }

  cellAt(minute: number): GapCell {
    const on   = this.#states[minute]!
    const now  = this.switches.includes(minute)
    const made = bisectRight(this.switches, minute)

    return {
      count : `${made} of ${this.switches.length}`,
      mark  : now ? 'ring' : on ? 'on' : 'off',
      word  : wordAt(on, now, this.#day.readings[minute]! < this.#entry.onLux)
    }
  }

  spokenAt(minute: number): string {
    const { count, word } = this.cellAt(minute)

    return `${this.#entry.name}, ${word.toLowerCase()}, ${count} ${unit(this.switches.length)}.`
  }
}

function drawing(
  { big, margin, plot, width } : (typeof LAYOUTS)[number],
  readings                     : readonly number[],
  runs                         : readonly [SensorRun, SensorRun]
): GapLayout {
  const right = width - margin
  const x     = scaleLinear([FROM, TO], [LEFT, right])
  const y     = scaleLinear(LUX_DOMAIN, [plot, TOP])
  const path  = line<number>()
    .digits(1)
    .x((_, index) => x(FROM + index))
    .y(y)
  const lanes = runs.map(({ spans, switches }, index) => {
    const chip = plot + 26 + index * 94

    return {
      bottom : chip + 46,
      chip   : chip,
      rings  : switches.map((minute) => tenth(x(minute))),
      spans  : spans.map(([start, end]) => ({ width: tenth(x(end) - x(start)), x: tenth(x(start)) })),
      top    : chip + 20
    }
  })
  const cut = (at: number, from: number) =>
    `M${at} ${from}V${plot}${lanes.map(({ bottom, top }) => `M${at} ${top - 6}V${bottom + 6}`).join('')}`
  const onY = tenth(y(ON_LUX))

  return {
    big    : big,
    guide  : cut(0, 4),
    height : lanes.at(-1)!.bottom + 44,
    lanes  : lanes,
    left   : LEFT,
    levelX : right + 18,
    offY   : tenth(y(OFF_LUX)),
    onY    : onY,
    path   : path(readings)!,
    right  : right,
    ties   : runs[0].switches.map((minute) => cut(tenth(x(minute)), onY)),
    width  : width,
    x      : readings.map((_, index) => tenth(x(FROM + index))),
    y      : readings.map((lux) => tenth(y(lux)))
  }
}

function minuteFacts(day: SampleDay, lux: number, minute: number, runs: readonly SensorRun[]): GapMinute {
  const clock   = day.clock(minute)
  const written = formatLux(lux)
  const reading = `${clock}, ${written} lux`
  const said    = runs.map((run) => run.spokenAt(minute))

  return {
    cells   : runs.map((run) => run.cellAt(minute)),
    clock   : clock,
    lux     : written,
    reading : reading,
    spoken  : `${reading}. ${said.join(' ')}`
  }
}

function sensorEntry(name: string, offLux: number): ThresholdEntry {
  const parsed = ThresholdEntry.parse({ name, offLux, onLux: ON_LUX }, 0)

  if (parsed instanceof ThresholdEntry) return parsed

  throw new Error(parsed.line)
}

function times(count: number): string {
  return count === 1 ? 'once' : `${count} times`
}

function unit(count: number): string {
  return count === 1 ? 'switch' : 'switches'
}

function wordAt(on: boolean, switched: boolean, within: boolean): string {
  if (switched) return `Turns ${on ? 'on' : 'off'}`
  if (!on) return 'Off'

  return within ? 'Holds on' : 'On'
}

/**
 * Runs the plugin's threshold entry at one level and at two across `day`, from
 * midnight, and sets out the late morning where the reading crosses the on
 * level back and forth. The next value below the on level stands in for the off
 * level of the sensor without a gap, since the plugin rejects two equal levels.
 */
export function theGap(day: SampleDay): Gap {
  const runs = [
    new SensorRun(day, sensorEntry('Without a gap', ON_LUX * (1 - Number.EPSILON))),
    new SensorRun(day, sensorEntry('With a gap', OFF_LUX))
  ] as const
  const readings = day.readings.slice(FROM, TO + 1)
  const first    = runs[1].switches[0]!
  const rest     = first + minIndex(day.readings.slice(first, TO + 1))
  const crossing = runs[0].switches

  return {
    direction : `whose on level of ${formatLux(ON_LUX)} lux sits above its off level of `
              + `${formatLux(OFF_LUX)} turns on as the reading rises to the on level and off once it falls `
              + 'below the off level',
    label     : `The reading from ${day.clock(FROM)} to ${day.clock(TO)} against the gap from `
              + `${formatLux(OFF_LUX)} to ${formatLux(ON_LUX)} lux, crossing ${formatLux(ON_LUX)} `
              + `${times(crossing.length)}, `
              + `at ${clockListFormat.format(crossing.map((minute) => day.clock(minute)))}, `
              + `and falling no lower than ${formatLux(day.readings[rest]!)} lux after ${day.clock(first)}`,
    layouts   : LAYOUTS.map((layout) => drawing(layout, readings, runs)),
    minutes   : readings.map((lux, index) => minuteFacts(day, lux, FROM + index, runs)),
    noon      : SampleDay.NOON - FROM,
    rest      : rest - FROM,
    sensors   : [runs[0].sensor, runs[1].sensor],
    span      : [day.clock(FROM), day.clock(TO)]
  }
}
