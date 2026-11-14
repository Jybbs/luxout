import { Seasons }                      from 'astronomy-engine'
import { least, maxIndex, range, sort } from 'd3-array'

import { TWILIGHT }                      from '../../../../src/daylight/clear-sky.ts'
import { DAY, HOUR_MINUTES }             from './clock.ts'
import { formatClock, formatDegrees }    from './format.ts'
import { SampleDay, crossings, instant } from './sample-day.ts'
import * as curve                        from './sun-curve.ts'
import { tenth }                         from './tenth.ts'

/**
 * The figures of the sentence above the drawing, on the day it opens on.
 */
interface SunLede {
  readonly clock   : string
  readonly height  : string
  readonly opening : string
  readonly share   : string
}

/**
 * A day of the year the drawing keeps a curve for, as one of the year's named
 * days or as the 21st of a month between them.
 */
interface SunMark {
  readonly day   : number
  readonly named : boolean
}

/**
 * What The Sun's Path draws, each day the count of days past January 1.
 */
export interface SunYear {
  readonly days    : readonly curve.SunDay[]
  readonly lede    : SunLede
  readonly marks   : readonly SunMark[]
  readonly minutes : readonly number[]  // The sample day's altitude in degrees at each minute from midnight
  readonly months  : readonly { readonly left: number, readonly word: string }[]
  readonly rest    : number
  readonly sample  : number
  readonly year    : number
}

const SHARES = [
  [1 / 4, 'a quarter'],
  [1 / 3, 'a third'],
  [1 / 2, 'half'],
  [2 / 3, 'two thirds'],
  [3 / 4, 'three quarters']
] as const
const monthWord = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })

function crossing(altitudes: readonly number[], index: number): number {
  const before = altitudes[index - 1]!

  return Math.ceil((index - 1 + (TWILIGHT.sunset - before) / (altitudes[index]! - before)) * curve.SUN_GRID)
}

function dayFigures(altitudes: readonly number[]): Omit<curve.SunDay, 'altitudes'> {
  const [up, down] = crossings(altitudes, TWILIGHT.sunset)

  const top       = maxIndex(altitudes)
  const [a, b, c] = [altitudes[top - 1]!, altitudes[top]!, altitudes[top + 1]!]
  const bend      = a - 2 * b + c

  return {
    rise : crossing(altitudes, up),
    set  : crossing(altitudes, down),
    peak : {
      altitude : tenth(b - (a - c) ** 2 / (8 * bend)),
      minute   : Math.round((top + (a - c) / (2 * bend)) * curve.SUN_GRID)
    }
  }
}

function hundredth(value: number): number {
  return Math.round(value * 100) / 100
}

function midnightOf(day: SampleDay, index: number, sample: number): number {
  const minute = (index - sample) * SampleDay.MINUTES

  return day.clock(minute) === '00:00' ? minute : minute + HOUR_MINUTES
}

function sunDay(day: SampleDay, index: number, sample: number): curve.SunDay {
  const zero  = midnightOf(day, index, sample)
  const extra = midnightOf(day, index + 1, sample) - zero - SampleDay.MINUTES
  const exact = range(0, SampleDay.MINUTES + 1, curve.SUN_GRID).map((minute) =>
    day.sun.altitude(instant(zero + minute + (minute >= 120 ? extra : 0)))
  )

  return {
    ...dayFigures(exact),
    altitudes: exact.map(tenth)
  }
}

/**
 * Writes `fraction` as the nearest plain share, leaning under or over it where
 * the two differ by a hundredth or more.
 */
export function shareWords(fraction: number): string {
  const [at, name] = least(SHARES, ([share]) => Math.abs(share - fraction))!

  const lean = Math.abs(at - fraction) < 0.01 ? 'about' : fraction < at ? 'a little under' : 'a little over'

  return `${lean} ${name}`
}

/**
 * Samples the sun at the sample day's place through every day of that day's
 * year on the local clock, moving each minute from 02:00 by the hour a change
 * of the clock that night adds or removes, and names the curves the year keeps:
 * the equinoxes, the solstices, the sample day, and the 21st of the other
 * months.
 */
export function sunYear(day: SampleDay): SunYear {
  const opening = instant(0)
  const year    = opening.getUTCFullYear()
  const newYear = Date.UTC(year, 0, 1)
  const sample  = Math.floor((opening.getTime() - newYear) / DAY)
  const dayOf   = (month: number, date: number) => (Date.UTC(year, month, date) - newYear) / DAY
  const count   = dayOf(12, 1)  // The days before the next January 1
  const days    = range(count).map((index) => sunDay(day, index, sample))
  const seasons = Seasons(year)
  const turning = [seasons.mar_equinox, seasons.jun_solstice, seasons.sep_equinox, seasons.dec_solstice].map(
    ({ date }) => days.findLastIndex((_, index) => instant(midnightOf(day, index, sample)) <= date)
  )
  const named = [...turning, sample].map((index) => ({ day: index, named: true }))
  const quiet = range(12)
    .filter((month) => !turning.some((index) => new Date(newYear + index * DAY).getUTCMonth() === month))
    .map((month) => ({ day: dayOf(month, 21), named: false }))
  const { peak } = days[sample]!

  return {
    days    : days,
    marks   : sort([...named, ...quiet], ({ day }) => day),
    minutes : day.altitudes.map(hundredth),
    rest    : SampleDay.REST,
    sample  : sample,
    year    : year,

    lede: {
      clock   : formatClock(peak.minute),
      height  : formatDegrees(peak.altitude),
      opening : day.date,
      share   : shareWords(peak.altitude / 90)
    },

    months: range(12).map((month) => ({
      left : tenth(dayOf(month, 15) / (count - 1) * 100),
      word : monthWord.format(Date.UTC(year, month, 1))
    }))
  }
}
