import { clamp }                                        from '@vueuse/core'
import { clampRgb, converter, formatHex, wcagContrast } from 'culori'
import { greatest, maxIndex, range }                    from 'd3-array'
import { renderToString }                               from 'vue/server-renderer'

import { TWILIGHT }                            from '../../../../src/daylight/clear-sky.ts'
import { seeded }                              from '../cards/seeded.ts'
import { colorAt, mix }                        from '../cards/sky.ts'
import type { Bibliography }                   from '../citations/bibliography.ts'
import { type Source, sourcesFrom }            from '../config/sources.ts'
import { DAY_MINUTES, HOUR_MINUTES, hourWord } from '../daylight/clock.ts'
import { phaseOf }                             from '../daylight/day-dial.ts'
import { luxRange }                            from '../daylight/homekit.ts'
import { type SampleDay, crossings, instant }  from '../daylight/sample-day.ts'
import { skyShade }                            from '../daylight/sky-ramp.ts'
import { tenth }                               from '../daylight/tenth.ts'
import type { Logo }                           from '../logo/logo.ts'
import { smoothstep }                          from '../motion/timing.ts'
import { SCHEMES, type Scheme, type Tokens }   from '../theme/tokens.ts'

/**
 * The sample day as the front page reads it, each figure rounded to what a
 * reader sees.
 */
export interface FrontDay {
  readonly altitudes  : readonly number[]           // Degrees, at each minute from midnight
  readonly clearSkies : readonly number[]           // The unclamped clear-sky lux at each minute
  readonly factors    : readonly (number | null)[]  // The cloud factor, `null` where no step covers it
  readonly noon       : number                      // The minute the sun stands highest
  readonly phases     : readonly Phase[]
  readonly range      : { readonly max: number, readonly min: number }
  readonly readings   : readonly number[]           // The clamped lux at each minute
  readonly rise       : number
  readonly set        : number
  readonly window     : readonly [from: number, to: number]
}

/**
 * The hero's backdrop: the clear sky's light from noon down to HomeKit's floor,
 * and the shades its sky, tint, and letters take in each scheme.
 */
interface FrontHero {
  /**
   * The sun's path above the horizon from `reach` minutes before noon to as
   * many after, as dots every `ARC.steps` minutes, in a box `reach` minutes
   * wide either side of noon and a thousand units tall from the noon sun down
   * to the horizon.
   */
  readonly arcs    : readonly string[]
  readonly inks    : typeof INKS        // The tokens the letters above the horizon take, by the sky behind them
  readonly logs    : readonly number[]  // The clamped clear sky's base-ten logarithm, noon to the floor
  readonly reach   : number             // The minutes the arcs span either side of noon
  readonly schemes : Readonly<Record<Scheme, HeroScheme>>
  readonly shares  : Logo['shares']
}

/**
 * Everything the front page draws from the sample day.
 */
export interface FrontPage {
  readonly date    : string
  readonly day     : FrontDay
  readonly hero    : FrontHero
  readonly place   : string
  readonly sources : readonly Source[]
  readonly strip   : FrontStrip
}

/**
 * The Day Strip's drawing in a `viewBox` the width of the day in minutes and a
 * hundred units tall.
 */
interface FrontStrip {
  readonly clear    : readonly string[]  // The clear sky's color every `STOP_MINUTES`
  readonly cloud    : string             // The morning's clouds, as thick as the light they hold back
  readonly forecast : readonly string[]  // The forecast's color every `STOP_MINUTES`, grayed by the clouds
  readonly hours    : readonly Hour[]
  readonly layers   : typeof LAYERS
  readonly star     : string             // The stars' color
  readonly stars    : readonly Star[]
}

/**
 * The colors the hero takes in one scheme at each of `STEPS + 1` places along
 * HomeKit's range on its logarithmic scale.
 */
interface HeroScheme {
  readonly dark  : readonly boolean[]  // Whether the letters above the horizon take the dark ink
  readonly skies : readonly string[]
  readonly tints : readonly string[]   // The color the bands mix toward, as an `oklab()`
  readonly title : string
}

/**
 * A figure under the Day Strip's scale.
 */
interface Hour {
  readonly at   : number
  readonly near : boolean  // Whether a crossing's chip covers the figure on a narrow strip
  readonly word : string
}

/**
 * A run of the day in one phase of daylight or twilight, from `from` to the
 * next run's start.
 */
interface Phase {
  readonly from : number
  readonly name : string
}

/**
 * The place the sample day stands, by the name and the time zone the Location
 * Search records for it.
 */
interface Place {
  readonly name     : string
  readonly timezone : string
}

/**
 * A star of the Day Strip's night, its place as shares of the day and of the
 * sky above the deck.
 */
interface Star {
  readonly phase : number
  readonly rate  : number
  readonly shine : number
  readonly size  : number
  readonly u     : number
  readonly v     : number
}

const ARC          = { reach: 450, steps: [5, 8, 16] }
const CLOUD_CAP    = 8                                // The minutes the cloud's ends round over
const CROSSING     = { near: 240, over: 100 }         // The minutes either side of a crossing its chip covers
const HUE_REACH    = 2.5                              // How far a tint's hue moves per unit of lightness
const INKS         = { dark: '--luxout-dark', light: '--luxout-ground' }
const LAYERS       = { deck: 0.48, under: 0.72 }      // The strip's cloud deck and the layer under it
const REACH        = { dark: 0.6, light: 0.2 }        // The lightness a high sun draws toward each ground
const SEED         = 0x9e3779b9
const SHADE        = '#807c76'                        // The gray the light under the clouds moves toward
const STARS        = 150
const STEPS        = 255
const STOP_MINUTES = 10
const oklab        = converter('oklab')

/**
 * Reads the front page's drawings off `day` at `place`, the sky's shades
 * against the two grounds `tokens` declares, the hero's title from `logo`, and
 * the sources' addresses from `bibliography`.
 */
export async function frontPage(
  bibliography : Bibliography,
  day          : SampleDay,
  logo         : Logo,
  place        : Place,
  tokens       : Tokens
): Promise<FrontPage> {
  const noon        = maxIndex(day.altitudes)
  const [rise, set] = crossings(day.altitudes, TWILIGHT.sunset)
  const [from, to]  = day.span
  const factors     = day.factors.map((factor, minute) => minute >= from && minute <= to ? factor : null)
  const floor       = day.readings.findIndex((lux, minute) => minute > noon && lux <= luxRange.min)

  return {
    date    : dateIn(place.timezone),
    place   : place.name,
    sources : sourcesFrom(bibliography),

    day: {
      altitudes  : day.altitudes.map(tenth),
      clearSkies : day.clearSkies.map(significant),
      factors    : factors.map((factor) => factor === null ? null : Number(factor.toFixed(4))),
      noon       : noon,
      phases     : phasesOf(day.altitudes),
      range      : luxRange,
      readings   : day.readings.map(significant),
      rise       : rise,
      set        : set,
      window     : [from, to]
    },

    hero: {
      arcs   : ARC.steps.map((step) => arcOf(day.altitudes, noon, step)),
      inks   : INKS,
      reach  : ARC.reach,
      shares : logo.shares,

      logs: day.clearSkies
        .slice(noon, floor + 1)
        .map((lux) => Number(Math.log10(clamp(lux, luxRange.min, luxRange.max)).toFixed(4))),

      schemes: Object.fromEntries(await Promise.all(SCHEMES.map(async (scheme) =>
        [scheme, await heroScheme(logo, scheme, tokens)] as const
      ))) as Record<Scheme, HeroScheme>
    },

    strip: {
      clear  : range(0, DAY_MINUTES + 1, STOP_MINUTES).map((minute) => colorAt(day.clearSkies[minute]!)),
      cloud  : cloudOf(factors, from, to),
      layers : LAYERS,
      star   : tokens.color(INKS.light, 'light'),
      stars  : starsOf(day.clearSkies),

      forecast: range(0, DAY_MINUTES + 1, STOP_MINUTES).map((minute) =>
        mix(colorAt(day.readings[minute]!), SHADE, 1 - (factors[minute] ?? 1))
      ),

      hours: range(0, DAY_MINUTES + 1, 3 * HOUR_MINUTES)
        .map((at) => ({ at, away: Math.min(Math.abs(at - rise), Math.abs(at - set)) }))
        .filter(({ away }) => away > CROSSING.over)
        .map(({ at, away }) => ({ at, near: away <= CROSSING.near, word: hourWord(at / HOUR_MINUTES) }))
    }
  }
}

/**
 * Draws each dot of the sun's path above the horizon every `step` minutes as a
 * subpath of no length, which a round cap draws as a dot.
 */
function arcOf(altitudes: readonly number[], noon: number, step: number): string {
  const peak = altitudes[noon]!

  return range(noon - ARC.reach, noon + ARC.reach + 1, step)
    .filter((minute) => altitudes[minute]! >= 0)
    .map((minute) => `M${minute - noon + ARC.reach} ${tenth(1000 * (1 - altitudes[minute]! / peak))}h0`)
    .join('')
}

/**
 * Draws the morning's clouds across the window as a band centered between the
 * deck and the layer under it, as thick as twice that gap times the share of
 * light they hold back, its ends rounded over `CLOUD_CAP` minutes.
 */
function cloudOf(factors: readonly (number | null)[], from: number, to: number): string {
  const [deck, under] = [100 * LAYERS.deck, 100 * LAYERS.under]
  const middle        = (deck + under) / 2
  const minutes       = range(from, to + 1)
  const depth         = (minute: number) => (1 - (factors[minute] ?? 1)) * (under - deck)
    * smoothstep((minute - from) / CLOUD_CAP) * smoothstep((to - minute) / CLOUD_CAP)
  const top    = minutes.map((minute) => `${minute} ${tenth(middle - depth(minute))}`)
  const bottom = minutes.toReversed().map((minute) => `${minute} ${tenth(middle + depth(minute))}`)

  return `M${[...top, ...bottom].join('L')}Z`
}

function dateIn(timeZone: string): string {
  const format = new Intl.DateTimeFormat('en-US', {
    day      : 'numeric',
    month    : 'long',
    timeZone,
    weekday  : 'long',
    year     : 'numeric'
  })
  const parts  = Object.fromEntries(format.formatToParts(instant(0)).map(({ type, value }) => [type, value]))

  return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}`
}

/**
 * Shades the hero in `scheme` at each place along HomeKit's range: the sky ramp
 * with its chroma eased and its lightness drawn toward the ground `tokens`
 * declares as the light nears full sun, the ink above the horizon with the
 * greater contrast on it, and the color the bands mix toward, whose hue moves
 * `HUE_REACH` times as far as its lightness.
 */
async function heroScheme(logo: Logo, scheme: Scheme, tokens: Tokens): Promise<HeroScheme> {
  const inks  = { dark: tokens.color(INKS.dark, scheme), light: tokens.color(INKS.light, scheme) }
  const base  = oklab(tokens.color('--color-ground', scheme))!
  const pull  = REACH[scheme]
  const skies = range(STEPS + 1).map((step) => {
    const high        = smoothstep((step / STEPS - 0.62) / 0.38)
    const keep        = 1 - 0.45 * high
    const { a, b, l } = oklab(skyShade(step / STEPS).fill)!

    return { a: a * keep, b: b * keep, l: l + (base.l - l) * pull * high, mode: 'oklab' as const }
  })
  const hexes = skies.map((sky) => formatHex(clampRgb(sky)))

  return {
    dark  : hexes.map((sky) => greatest(Object.values(inks), (ink) => wcagContrast(sky, ink)) === inks.dark),
    skies : hexes,
    tints : skies.map(({ a, b, l }) =>
      `oklab(${l.toFixed(4)} ${toward(base.a, a).toFixed(4)} ${toward(base.b, b).toFixed(4)})`
    ),
    title : await renderToString(logo.hero(scheme))
  }
}

function phasesOf(altitudes: readonly number[]): Phase[] {
  return altitudes
    .map((altitude, minute) => ({ from: minute, name: phaseOf(altitude) }))
    .filter(({ name }, minute) => minute === 0 || name !== phaseOf(altitudes[minute - 1]!))
}

function significant(value: number): number {
  return Number(value.toPrecision(3))
}

/**
 * Scatters the same stars on every build, each shining as the clear sky over
 * it darkens below 1 lux and gone at 1,000 lux.
 */
function starsOf(clearSkies: readonly number[]): Star[] {
  const next = seeded(SEED)
  const read = (digits = 3) => Number(next().toFixed(digits))

  return range(STARS)
    .map(() => {
      const [u, v, size, phase, rate] = [
        read(), read(), 0.5 + 0.8 * read(), 2 * Math.PI * read(), 0.6 + 1.4 * read()
      ]
      const lux = clearSkies[Math.round(u * DAY_MINUTES)]!

      return {
        phase : Number(phase.toFixed(3)),
        rate  : Number(rate.toFixed(3)),
        shine : Number((1 - smoothstep((Math.log10(Math.max(lux, 1e-30)) + 3) / 3)).toFixed(3)),
        size  : Number(size.toFixed(3)),
        u     : u,
        v     : v
      }
    })
    .filter(({ shine }) => shine > 0.02)
}

function toward(from: number, to: number): number {
  return from + (to - from) * HUE_REACH
}
