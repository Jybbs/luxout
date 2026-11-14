import { bisector, cumsum, range, sum } from 'd3-array'
import { line }                         from 'd3-shape'

import { smoothstep }                from '../motion/timing.ts'
import { DAY_MINUTES, HOUR_MINUTES } from './clock.ts'
import { tenth }                     from './tenth.ts'

/**
 * The marks the dial draws, each radius a share of the way from HomeKit's floor
 * on the inner ring to its ceiling on the rim.
 */
export interface DialMarks {
  readonly clear   : readonly number[]  // The clear sky's share at each minute from midnight
  readonly reading : readonly number[]  // The reading's share at each minute from midnight
  readonly spans   : readonly Span[]    // Each stretch's minutes, the night's running past 1440
  readonly washes  : readonly (readonly [Span, Span])[]  // Each twilight depth's morning and evening minutes
  readonly window  : Span               // The minutes the stored window covers
}

/**
 * A half of the clock, 0 for the hours from midnight to noon and 1 for the
 * hours after.
 */
export type Half = (typeof HALVES)[number]

type Span = readonly [from: number, to: number]

export const DIAL = {
  bracket : 147,
  center  : { x: 210, y: 184 },
  floor   : 79.2,  // The floor ring's radius, three fifths of the rim's
  height  : 368,
  rim     : 132,
  track   : 140,
  width   : 420
}
const EDGE                 = 45  // The minutes the pace takes to reach the true clock at noon and midnight
const HALF                 = DAY_MINUTES / 2
export const HALVES        = [0, 1] as const
export const OPENING_STEPS = 24  // The opening steps with their own paths, so a third is a whole step
const QUARTER              = DAY_MINUTES / 4
const SOFT                 = 40  // The minutes the pace takes to ease between a twilight's and its half's
const STEP                 = 3   // The minutes between the points of a curve
const TAU                  = 2 * Math.PI
const halfDay              = range(HALF + 1)

/**
 * Writes the dial's paths for each half of the clock, which stay apart since
 * each twilight's opening moves only the minutes of the half holding it.
 */
export class DialPlot {
  readonly #lenses : readonly (readonly number[])[]
  readonly #marks  : DialMarks

  constructor(marks: DialMarks) {
    this.#marks  = marks
    this.#lenses = HALVES.map((half) => lens(marks.spans[this.twilight(half)]!, half * HALF))
  }

  /**
   * Finds the minute at a pointer's `angle` on the dial, in radians clockwise
   * from midnight at the foot, with `opens` giving how far each half's twilight
   * has opened toward its quarter.
   */
  minuteAt(angle: number, opens: readonly number[]): number {
    const turned = (angle + TAU) % TAU
    const half   = turned < Math.PI ? 0 : 1
    const low    = half * HALF
    const open   = opens[half]!

    return low + bisector((minute: number) => this.turn(half, low + minute, open)).left(halfDay, turned)
  }

  /**
   * Writes every path of one half of the clock in the order the dial draws it,
   * with that half's twilight `open`, from 0 to 1, of the way toward its
   * quarter.
   */
  paths(half: Half, open: number): readonly string[] {
    const { bracket, center, floor: inner, rim, track } = DIAL

    const low   = half * HALF
    const turn  = (minute: number) => this.turn(half, minute, open)
    const xAt   = (minute: number, radius: number) => center.x - radius * Math.sin(turn(minute))
    const yAt   = (minute: number, radius: number) => center.y + radius * Math.cos(turn(minute))
    const point = (minute: number, radius: number) =>
      `${tenth(xAt(minute, radius))} ${tenth(yAt(minute, radius))}`
    const arc = (span: Span | undefined, radius: number) => span
      ? `M${point(span[0], radius)}A${radius} ${radius} 0 0 1 ${point(span[1], radius)}`
      : ''
    const sector = (span: Span) => `${arc(span, rim)}L${point(span[1], inner)}`
      + `A${inner} ${inner} 0 0 0 ${point(span[0], inner)}Z`
    const shareAt = (shares: readonly number[], minute: number) =>
      shares[(minute + DAY_MINUTES) % DAY_MINUTES]!
    const radial = (shares: readonly number[], minute: number) =>
      inner + (rim - inner) * shareAt(shares, minute)
    const curve = (shares: readonly number[]) => line<number>()
      .digits(1)
      .x((minute) => xAt(minute, radial(shares, minute)))
      .y((minute) => yAt(minute, radial(shares, minute)))
    const pointsOf = ([from, to]: Span) => [...range(from, to, STEP), to]
    const whole    = pointsOf([low - STEP, low + HALF + STEP])

    const { clear, reading, spans, washes, window } = this.#marks

    return [
      ...washes.map((wash) => sector(wash[half])),
      `${curve(clear)(whole)!}L${point(whole.at(-1)!, inner)}A${inner} ${inner} 0 1 0 `
      + `${point(whole[0]!, inner)}Z`,
      curve(clear).defined((minute) => shareAt(clear, minute) > 0)(whole)!,
      curve(reading)(whole)!,
      arc(within(window, low), track),
      arc(within([window[1], DAY_MINUTES + window[0]], low), track),
      ...spans.flatMap((span) => {
        const part = within(span, low)

        return [arc(part, bracket), part ? curve(reading)(pointsOf(part))! : '']
      }),
      range(low, low + HALF, HOUR_MINUTES)
        .map((hour) => `M${point(hour, rim + 2)}L${point(hour, rim + 6)}`)
        .join('')
    ]
  }

  /**
   * Finds the angle of `minute` on the dial, in radians clockwise from midnight
   * at the foot, with the twilight of `half` opened `open` of the way toward
   * its quarter.
   */
  turn(half: Half, minute: number, open: number): number {
    return minute / DAY_MINUTES * TAU + open * (this.#lenses[half]![minute - half * HALF] ?? 0)
  }

  /**
   * Finds the stretch a half of the clock opens, the one that fits inside it
   * narrower than a quarter of the dial.
   */
  twilight(half: Half): number {
    const low = half * HALF

    return this.#marks.spans.findIndex(([from, to]) => to - from < QUARTER && from >= low && to <= low + HALF)
  }
}

/**
 * Finds how far a twilight's opening moves each minute of its half of the clock
 * from the true clock, in radians. Each minute moves the dial at a pace that is
 * fast across the twilight, slow across the rest of the half, and the true
 * clock's at noon and at midnight, eased along smoothstep, and the two paces
 * solve for the twilight filling a quarter of the dial and the whole filling
 * half.
 */
function lens([from, to]: Span, low: number): readonly number[] {
  const fast = halfDay.map((minute) =>
    smoothstep((low + minute - from) / SOFT + 0.5) * smoothstep((to - low - minute) / SOFT + 0.5)
  )
  const edge  = halfDay.map((minute) => 2 - smoothstep(minute / EDGE) - smoothstep((HALF - minute) / EDGE))
  const slow  = halfDay.map((_, index) => 1 - fast[index]! - edge[index]!)
  const areas = (start: number, end: number) => [slow, fast, edge].map((rates) =>
    sum(range(start, end), (index) => midpoint(rates, index))
  ) as [number, number, number]
  const whole  = areas(0, HALF)
  const part   = areas(from - low, to - low)
  const det    = whole[0] * part[1] - whole[1] * part[0]
  const calm   = ((HALF - whole[2]) * part[1] - whole[1] * (QUARTER - part[2])) / det
  const pace   = (whole[0] * (QUARTER - part[2]) - part[0] * (HALF - whole[2])) / det
  const rates  = halfDay.map((_, index) => calm * slow[index]! + pace * fast[index]! + edge[index]!)
  const passed = [0, ...cumsum(range(HALF), (index) => midpoint(rates, index))]

  return passed.map((minutes, minute) => (minutes - minute) / DAY_MINUTES * TAU)
}

function midpoint(rates: readonly number[], index: number): number {
  return (rates[index]! + rates[index + 1]!) / 2
}

function within([from, to]: Span, low: number): Span | undefined {
  return [0, DAY_MINUTES]
    .map((shift): Span => [Math.max(from - shift, low), Math.min(to - shift, low + HALF)])
    .find(([start, end]) => start < end)
}
