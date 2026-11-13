import { range } from 'd3-array'

import { REQUEST_TUNING }                                   from '../../../../src/weather/client.ts'
import { SCHEDULE_TUNING }                                  from '../../../../src/weather/schedule.ts'
import { DAY_MINUTES, MINUTE, STEP_MINUTES }                from '../daylight/clock.ts'
import { formatClock, formatPlace, formatSpan, listFormat } from '../daylight/format.ts'
import type { SampleDay }                                   from '../daylight/sample-day.ts'
import { tenth }                                            from '../daylight/tenth.ts'

export type ClockKey = (typeof KEYS)[number]

const CROSS   = 6.5  // The half width of the cross marking a failed request
const CROWDED = 3    // The minutes within which a retry's word quiets a quarter hour's
const HOUR    = 60
const KEYS    = ['often', 'sends', 'fails'] as const
/**
 * The radii in the face's units of each ring the face draws on, the words
 * standing outside the rim and a journey running from the core out past them.
 */
const RADII  = { core: 84, far: 196, hand: 141, minute: 144, rim: 150, tick: 136, word: 188 } as const
const RETRY  = { from: 156, to: 168 }  // The radii of a retry's mark, outside the rim
const SAMPLE = 17                      // The minute past each hour the sample install requests at
const SIDE   = 400
const WORDS  = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const CENTER = SIDE / 2

/**
 * One state of the face, with the words its core sets and the sentence its tab
 * shows.
 */
interface ClockState {
  readonly big     : string
  readonly figures : boolean
  readonly key     : ClockKey
  readonly name    : string
  readonly small   : string
  readonly text    : string
}

/**
 * One label around the rim, at its place in percent of the face.
 */
export interface ClockWord {
  readonly left  : number
  readonly quiet : boolean
  readonly top   : number
  readonly word  : string
}

/**
 * One hour of the fetch schedule as a clock face, in the face's units.
 */
export interface RequestClock {
  readonly cross    : string
  readonly hand     : string
  readonly heading  : readonly [x: number, y: number]
  readonly label    : string
  readonly minute   : number
  readonly minutes  : readonly string[]
  readonly quarters : readonly ClockWord[]
  readonly radii    : typeof RADII
  readonly request  : readonly [x: number, y: number]
  readonly retries  : readonly string[]
  readonly said     : readonly ClockWord[]
  readonly side     : number
  readonly states   : readonly ClockState[]
  readonly ticks    : readonly string[]
}

function at(minute: number, radius: number): [x: number, y: number] {
  const [x, y] = headingOf(minute)

  return [tenth(CENTER + radius * x), tenth(CENTER + radius * y)]
}

function cross([x, y]: readonly [x: number, y: number]): string {
  const [left, right, top, bottom] = [x - CROSS, x + CROSS, y - CROSS, y + CROSS].map(tenth)

  return `M${left} ${top}L${right} ${bottom}M${right} ${top}L${left} ${bottom}`
}

function headingOf(minute: number): [x: number, y: number] {
  const turn = (minute % HOUR) / HOUR * 2 * Math.PI

  return [Math.sin(turn), -Math.cos(turn)]
}

function spoke(minute: number, from: number, to: number): string {
  const [ax, ay] = at(minute, from)
  const [bx, by] = at(minute, to)

  return `M${ax} ${ay}L${bx} ${by}`
}

function wordAt(minute: number, quiet = false): ClockWord {
  const [x, y] = at(minute, RADII.word)
  const word   = `:${String(minute % HOUR).padStart(2, '0')}`

  return { left: tenth(x / SIDE * 100), quiet, top: tenth(y / SIDE * 100), word }
}

/**
 * Finds the minutes after an hourly request at which a failing hour retries,
 * each wait twice the last from the schedule's first and none at or past the
 * next hourly request.
 */
export function retryOffsets(retry: number): number[] {
  const offsets: number[] = []

  for (let wait = retry / MINUTE, after = wait; after < HOUR; wait *= 2, after += wait) offsets.push(after)

  return offsets
}

/**
 * Lays out one hour of the sample install's fetch schedule, whose request in
 * the hour the sample window was fetched returned that window, and whose
 * request an hour later fails and retries.
 */
export function requestClock(day: SampleDay): RequestClock {
  const { forecast, past } = REQUEST_TUNING
  const offsets            = retryOffsets(SCHEDULE_TUNING.retry)
  const fetched            = Math.floor((day.span[0] + past * STEP_MINUTES) / HOUR)
  const fails              = fetched + 1
  const clockOf            = (hour: number, after = 0) => formatClock(hour * HOUR + SAMPLE + after)
  const retried            = listFormat.format(offsets.map((offset) => clockOf(fails, offset)))
  const pair               = formatPlace(day.window.place)
  const spanOf             = (steps: number) => formatSpan(steps * STEP_MINUTES * MINUTE)
  const crowded            = (minute: number) => offsets.some((offset) => {
    const apart = Math.abs((SAMPLE + offset) % HOUR - minute)

    return Math.min(apart, HOUR - apart) < CROWDED
  })
  const request            = at(SAMPLE, RADII.rim)
  const daily              = DAY_MINUTES / HOUR

  return {
    cross    : cross(request),
    hand     : spoke(SAMPLE, RADII.core, RADII.hand),
    heading  : headingOf(SAMPLE),
    label    : `A clock face of one hour, with the request at ${SAMPLE} past and, for the `
             + `${clockOf(fails)} hour that fails, the retries at ${retried}`,
    minute   : SAMPLE,
    quarters : [0, 15, 30, 45].map((minute) => wordAt(minute, crowded(minute))),
    radii    : RADII,
    request  : request,
    retries  : offsets.map((offset) => spoke(SAMPLE + offset, RETRY.from, RETRY.to)),
    said     : offsets.map((offset) => wordAt(SAMPLE + offset)),
    side     : SIDE,
    ticks    : range(0, HOUR, 5).map((minute) => spoke(minute, RADII.tick, RADII.rim)),

    minutes: range(HOUR).filter((minute) => minute % 5)
      .map((minute) => spoke(minute, RADII.minute, RADII.rim)),

    states: [
      {
        big     : `:${SAMPLE}`,
        figures : false,
        key     : 'often',
        name    : 'Every hour',
        small   : `past every hour, ${daily} a day`,
        text    : `One request an hour, at ${SAMPLE} past, a minute drawn at random when Homebridge `
                + `starts, so ${daily} requests a day.`
      },
      {
        big     : pair.replace(', ', '\n'),
        figures : true,
        key     : 'sends',
        name    : 'What it carries',
        small   : 'the place each request carries',
        text    : `Each request carries the place rounded to two decimals, ${pair}, which resolves it to `
                + `about a kilometer, and fetches sunlight at the ground every ${STEP_MINUTES} minutes, from `
                + `${spanOf(past)} before the current step to the step ${spanOf(forecast - 1)} after it.`
      },
      {
        big     : clockOf(fails),
        figures : false,
        key     : 'fails',
        name    : 'If an hour fails',
        small   : `fails, then ${WORDS[offsets.length]} retries`,
        text    : `The ${clockOf(fails)} request fails and is retried at ${retried}, each wait twice `
                + `the last, then nothing more until ${clockOf(fails + 1)}, while the reading keeps `
                + `using the ${clockOf(fetched)} forecast.`
      }
    ]
  }
}
