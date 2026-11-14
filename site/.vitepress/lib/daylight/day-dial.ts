import { bisectRight, extent, minIndex, pairs, sort } from 'd3-array'
import { scaleLog }                                   from 'd3-scale'

import { TWILIGHT }                     from '../../../../src/daylight/clear-sky.ts'
import { CLOUD_TUNING }                 from '../../../../src/daylight/cloud-factor.ts'
import { DIAL, type DialMarks }         from './dial-lens.ts'
import * as format                      from './format.ts'
import { luxRange }                     from './homekit.ts'
import { SampleDay, crossings, runsOf } from './sample-day.ts'
import { tenth }                        from './tenth.ts'

/**
 * What the dial draws and the words it sets around each stretch.
 */
export interface DayDial {
  readonly date      : string
  readonly label     : string
  readonly marks     : DialMarks
  readonly opens     : number
  readonly stretches : readonly DialStretch[]
}

/**
 * One stretch of the day a reader picks, with what the middle of the dial shows
 * for it and the reason beside the dial.
 */
interface DialStretch {
  readonly caption : string
  readonly figure  : string
  readonly name    : string
  readonly outer   : boolean
  readonly place   : { readonly left: number, readonly top: number }
  readonly span    : string
  readonly why     : string
}

/**
 * The sun's altitudes in degrees ending each depth of twilight, from the
 * deepest up.
 */
export const DEPTHS = sort(Object.values(TWILIGHT))
const GAP           = 22  // The room between the rim and the nearest edge of a name
const LETTER        = 11  // The width of one letter of a name
const NAME          = 24  // The height of a name
/**
 * Names the stretch of the day by how many of `DEPTHS` the sun stands at or
 * above.
 */
const PHASES        = ['Night', 'Astronomical twilight', 'Nautical twilight', 'Civil twilight', 'Daylight']
const shareScale    = scaleLog([luxRange.min, luxRange.max], [0, 1]).clamp(true)

function placeOf(from: number, name: string, to: number): DialStretch['place'] {
  const angle = (from + to) / 2 / SampleDay.MINUTES * 2 * Math.PI
  const ux    = -Math.sin(angle)
  const uy    = Math.cos(angle)
  const reach = DIAL.rim + GAP + name.length * LETTER / 2 * Math.abs(ux) + NAME / 2 * Math.abs(uy)

  return {
    left : tenth((DIAL.center.x + reach * ux) / DIAL.width * 100),
    top  : tenth((DIAL.center.y + reach * uy) / DIAL.height * 100)
  }
}

function shareOf(lux: number): number {
  return Math.round(shareScale(lux) * 1000) / 1000
}

/**
 * Reads the day's stretches off the plugin's estimate of `day`: the night on
 * HomeKit's floor, each twilight, the day, and the stored forecast window, each
 * with the figure and the reason the dial sets beside it.
 */
export function dayDial(day: SampleDay): DayDial {
  const { altitudes, clearSkies, cloud, readings } = day

  const [floorRise, floorSet] = runsOf(readings.map((lux) => lux > luxRange.min))[0]!
  const [rise, set]           = crossings(altitudes, TWILIGHT.sunset)
  const [from, to]            = day.span

  const low           = minIndex(clearSkies)
  const decades       = (minute: number) => Math.log10(readings[minute]! / luxRange.min).toFixed(1)
  const climb         = altitudes[rise]! - altitudes[floorRise]!
  const perDegree     = (Math.log10(clearSkies[rise]! / luxRange.min) / climb).toFixed(2)
  const [least, most] = extent(cloud.steps, ({ factor }) => factor) as [number, number]
  const borrowed      = cloud.steps[0]!.factor
  const reached       = DEPTHS.map((level) => crossings(altitudes, level))
  const edges         = [[0, SampleDay.MINUTES], ...reached] as const
  const lux           = (minute: number) => format.formatLux(readings[minute]!)
  const sun           = (minute: number) => format.formatDegrees(altitudes[minute]!)

  const stretches = [
    {
      caption : 'lux at HomeKit’s floor',
      figure  : format.formatLux(luxRange.min),
      from    : floorSet,
      name    : 'Night',
      to      : SampleDay.MINUTES + floorRise,
      why     : `The clear sky sinks to ${format.formatLux(clearSkies[low]!)} lux at ${day.clock(low)}, `
              + `${Math.log10(luxRange.min / clearSkies[low]!).toFixed(1)} decades under the lowest value `
              + 'HomeKit accepts, so the reading is clamped up to that floor.'
    },
    {
      caption : `decades up in ${rise - floorRise} min`,
      figure  : decades(rise),
      from    : floorRise,
      name    : 'Dawn',
      opens   : true,
      to      : rise,
      why     : `The sun climbs the ${climb.toFixed(1)}° from ${sun(floorRise)} to sunrise, and the clear `
              + `sky’s light rises about ${perDegree} decades with each degree, lifting the reading off `
              + `HomeKit’s floor to ${lux(rise)} lux.`
    },
    {
      caption : 'of the clear sky',
      figure  : `${format.formatFactor(least)}–${format.formatFactor(most)}`,
      from    : from,
      name    : 'Window',
      outer   : true,
      to      : to,
      why     : 'Each 15-minute step divides Open-Meteo’s forecast sunlight by the clear sky’s, a step with '
              + `the sun under ${CLOUD_TUNING.floor}° takes ${format.formatFactor(borrowed)}, the mean of `
              + `the ${CLOUD_TUNING.nearest} nearest, and from ${day.clock(to)}, the factor is 1.`
    },
    {
      caption : `lux at noon, sun at ${sun(SampleDay.NOON)}`,
      figure  : lux(SampleDay.NOON),
      from    : rise,
      name    : 'Day',
      to      : set,
      why     : 'By day, the clear sky follows the sun’s height, and the reading follows the clear sky, '
              + `under it by the forecast’s share until ${day.clock(to)} and on it from then to sunset.`
    },
    {
      caption : `decades down in ${floorSet - set} min`,
      figure  : decades(set),
      from    : set,
      name    : 'Dusk',
      to      : floorSet,
      why     : `The sun sinks from sunset to ${sun(floorSet)}, and with no stored window over these `
              + 'minutes, the reading is the clear sky alone, falling until it meets HomeKit’s floor at '
              + `${day.clock(floorSet)}.`
    }
  ]

  return {
    date  : day.date,
    label : 'The sample day around a 24-hour dial, midnight at the foot and noon at the top, the reading '
          + 'drawn outward on a log scale from HomeKit’s floor on the inner ring to '
          + `${format.formatLux(luxRange.max)} lux on the rim, the clear sky filled beneath it, each `
          + 'twilight’s depth shaded, and the forecast window and the fallback marked on a track outside, '
          + 'with hour ticks around the rim.',
    opens : stretches.findIndex(({ opens }) => opens),

    marks: {
      clear   : clearSkies.slice(0, SampleDay.MINUTES).map(shareOf),
      reading : readings.slice(0, SampleDay.MINUTES).map(shareOf),
      spans   : stretches.map(({ from, to }) => [from, to]),
      washes  : pairs(edges, (outer, inner) => [[outer[0], inner[0]], [inner[1], outer[1]]]),
      window  : [from, to]
    },

    stretches: stretches.map(({ caption, figure, from, name, outer, to, why }) => ({
      caption : caption,
      figure  : figure,
      name    : name,
      outer   : outer ?? false,
      place   : placeOf(from, name, to),
      span    : `${day.clock(from)}–${day.clock(to)}`,
      why     : why
    }))
  }
}

/**
 * Names the stretch of the day the sun stands in at `altitude` degrees, from
 * night through the three depths of twilight to daylight.
 */
export function phaseOf(altitude: number): string {
  return PHASES[bisectRight(DEPTHS, altitude)]!
}
