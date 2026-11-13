import { BRIDGE_SPAN, type ClearSky }      from '../../../../src/daylight/clear-sky.ts'
import type { CLOUD_TUNING }               from '../../../../src/daylight/cloud-factor.ts'
import type { REQUEST_TUNING }             from '../../../../src/weather/client.ts'
import { HOUR, MINUTE, STEP_MINUTES }      from '../../lib/daylight/clock.ts'
import type { CloudSteps }                 from '../../lib/daylight/cloud-steps.ts'
import type { DayDial }                    from '../../lib/daylight/day-dial.ts'
import type { FactorDay }                  from '../../lib/daylight/factor-day.ts'
import * as format                         from '../../lib/daylight/format.ts'
import type { Gap, GapSensor }             from '../../lib/daylight/gap.ts'
import { luxRange }                        from '../../lib/daylight/homekit.ts'
import type { DecadeScale }                from '../../lib/daylight/lux-scale.ts'
import type { SampleDay }                  from '../../lib/daylight/sample-day.ts'
import * as curve                          from '../../lib/daylight/sun-curve.ts'
import type { SunYear }                    from '../../lib/daylight/sun-year.ts'
import { type RequestClock, retryOffsets } from '../../lib/privacy/request-clock.ts'
import type { RoundedPlace }               from '../../lib/privacy/rounded-place.ts'
import type { SearchReplay }               from '../../lib/search/replay.ts'
import type { SettingRow }                 from '../../lib/settings/rows.ts'
import type { DebugLine }                  from '../../lib/troubleshooting/debug-line.ts'

type Cell = number | string

const BRIDGE_ALTITUDES = [BRIDGE_SPAN[0], -5, -4, -3, -2, -1, curve.SUNSET, 0, 5, 10]  // Degrees
const LEVELS           = [
  { altitude: BRIDGE_SPAN[0], name: 'The end of civil twilight' },
  { altitude: curve.SUNSET, name: 'Sunset' },
  { altitude: 10, name: 'A low sun' }
]

function markdownTable(headers: readonly string[], rows: readonly (readonly Cell[])[]): string {
  const line = (cells: readonly Cell[]) => `| ${cells.join(' | ')} |`
  const head = line(headers.map((header) => `**${header}**`))

  return [head, `|${'---|'.repeat(headers.length)}`, ...rows.map(line)].join('\n')
}

/**
 * Writes the table of the clear-sky curve at the altitudes around the bridge.
 */
export function bridgeTable(sky: ClearSky): string {
  return markdownTable(
    ["The Sun's Altitude", 'Clear Sky'],
    BRIDGE_ALTITUDES.map((altitude) => [
      curve.altitudeWord(altitude),
      `${format.formatLux(sky.illuminance(altitude))} lux`
    ])
  )
}

/**
 * Writes the sentences on the bridge, each figure from the curve itself.
 */
export function bridgeWords(sky: ClearSky): string {
  const step = (sky.refracted(curve.SUNSET) - curve.SUNSET).toFixed(2)
  const low  = format.formatLux(sky.illuminance(BRIDGE_SPAN[0]))
  const high = format.formatLux(sky.illuminance(curve.SUNSET))

  return `Below an altitude of ${curve.SUNSET_WORD}, the circular's refraction correction adds nothing, so `
       + `its refracted altitude steps by about ${step}° there and its lux jumps. The plugin keeps the `
       + `circular's curve at and below ${format.signed(BRIDGE_SPAN[0])}°, the end of civil twilight, and at `
       + `and above ${curve.SUNSET_WORD}. Between the two, the logarithm of the lux runs in a straight line `
       + `against the altitude, from the circular's ${low} lux to its ${high} lux, so the reading climbs `
       + 'through the cutoff without a step.'
}

/**
 * Writes the sentence that opens One Request an Hour.
 */
export function clockLede({ minute }: RequestClock): string {
  return 'The plugin asks [Open-Meteo](https://open-meteo.com/en/docs) for the forecast once an hour, at a '
       + `minute drawn at random when Homebridge starts, ${minute} past in the sample install, and retries a `
       + 'failed request as [While Fetches Fail](../estimate/failed-fetches.md#retries) sets out.'
}

/**
 * Writes the clock face's states as the Markdown table a page keeps for GitHub.
 */
export function clockTable({ states }: RequestClock): string {
  return markdownTable(['Tab', 'What the Face Shows'], states.map(({ name, text }) => [name, text]))
}

/**
 * Writes each step of the forecast as the Markdown table a page keeps for
 * GitHub.
 */
export function cloudTable({ steps }: CloudSteps): string {
  return markdownTable(
    ['Step', 'The Forecast', 'A Clear Sky', 'Share'],
    steps.map(({ borrowed, clear, clock, forecast, share }) => [
      clock,
      forecast,
      clear,
      borrowed ? `${share}, borrowed` : share
    ])
  )
}

/**
 * Writes the sentence that opens the dial, its clock times read off the
 * stretches the dial draws.
 */
export function dialLede({ date, stretches }: DayDial): string {
  const spanOf = (wanted: string) =>
    stretches.find(({ name }) => name === wanted)!.span.split('–') as [string, string]

  const [nightFrom, nightTo] = spanOf('Night')
  const [from, to]           = spanOf('Window')

  return `The dial draws ${date} at the zip code [Finding Your Place](../install/place.md) searches for. `
       + `The reading holds at HomeKit's floor of ${format.formatLux(luxRange.min)} lux from ${nightFrom} to `
       + `${nightTo} and climbs and falls through each twilight. It runs under the clear sky by the `
       + `forecast's share inside the one stored window, ${from} to ${to}, and follows the clear-sky curve `
       + 'alone outside it, as the plugin does wherever no stored window covers a minute.'
}

/**
 * Writes each stretch of the dial as the Markdown table a page keeps for
 * GitHub.
 */
export function dialTable({ stretches }: DayDial): string {
  return markdownTable(
    ['Stretch', 'Minutes', 'The Reading', 'What It Does There'],
    stretches.map(({ caption, figure, name, span, why }) => [name, span, `${figure} ${caption}`, why])
  )
}

/**
 * Writes the three terms at the resting minute as the Markdown table a page
 * keeps for GitHub.
 */
export function factorTable({ minutes, rest, terms }: FactorDay): string {
  return markdownTable(
    ['Term', `At ${minutes[rest]}`, 'Comes From'],
    terms.map(({ figures, name, note, unit }) => [name, `${figures[rest]} ${unit}`.trim(), note])
  )
}

/**
 * Writes how long a stored window carries the reading through failed fetches.
 */
export function fetchReach({ forecast }: typeof REQUEST_TUNING): string {
  const reach = (forecast - 1) * STEP_MINUTES * MINUTE

  return `A window's last step starts ${format.formatSteps(forecast - 1)} after the step its fetch falls in, `
       + `which carries the reading through ${Math.floor(reach / HOUR)} failed hourly fetches in a row.`
}

/**
 * Writes how often a failed fetch retries and how long a request runs.
 */
export function fetchRetry(retry: number, timeout: number): string {
  const count = retryOffsets(retry).length + 1
  const limit = format.formatAmount(timeout / 1000, 'second')

  return `The plugin retries ${format.formatSpan(retry)} after a failed fetch and doubles the wait each `
       + 'time, scheduling no retry at or past the next hourly fetch, so a failing hour sends at most '
       + `${count} requests. A request with no answer after ${limit} times out.`
}

/**
 * Writes the fields of the debug line as the Markdown table a page keeps for
 * GitHub.
 */
export function fieldTable({ fields }: DebugLine): string {
  return markdownTable(
    ['Field', 'In the Sample Line', 'What It Holds'],
    fields.map(({ name, note, value }) => [name, `\`${value}\``, note])
  )
}

/**
 * Replaces the text between each pair of named comment markers with the block
 * of that name, failing on a name the page does not mark.
 */
export function fillMarkers(source: string, blocks: Readonly<Record<string, string>>): string {
  return Object.entries(blocks).reduce((page, [name, block]) => {
    const open  = `<!-- ${name} -->`
    const close = `<!-- /${name} -->`
    const start = page.indexOf(open)
    const end   = page.indexOf(close)

    if (start < 0 || end < start) throw new Error(`The page marks no block named ${name}`)

    return `${page.slice(0, start + open.length)}\n\n${block}\n\n${page.slice(end)}`
  }, source)
}

/**
 * Writes the sentence on the span a step below the floor takes its factor from.
 */
export function floorWords({ ahead, behind, floor, nearest }: typeof CLOUD_TUNING): string {
  return 'The ratio means little while the sun sits low, where both figures run close to zero. A step whose '
       + `sun stands below ${floor}° once refracted takes the mean factor of the ${nearest} nearest daylight `
       + `steps, those at ${floor}° or above, from ${format.formatSpan(behind)} before it to `
       + `${format.formatSpan(ahead)} after it, and 1 where none lies in that span, as on a high-latitude `
       + `winter day whose sun never reaches ${floor}°.`
}

/**
 * Writes the sentence on which way the sensor with a gap switches, from its
 * two levels.
 */
export function gapDirection({ sensors: [, { offBelow, onAt }] }: Gap): string {
  return `A sensor whose on level of ${onAt} lux sits above its off level of ${offBelow} turns on as the `
       + 'reading rises to the on level and off once it falls below the off level.'
}

/**
 * Writes the two sensors as the Markdown table a page keeps for GitHub.
 */
export function gapTable({ sensors, span }: Gap): string {
  const row = (name: string, cell: (sensor: GapSensor) => Cell) => [name, ...sensors.map(cell)]

  return markdownTable(
    [`From ${span[0]} to ${span[1]}`, ...sensors.map(({ name }) => name)],
    [
      row('On at', ({ onAt }) => `${onAt} lux`),
      row('Off below', ({ offBelow }) => `${offBelow} lux`),
      row('Switches', ({ switches }) => switches),
      row('Switches at', ({ times }) => times.join(', '))
    ]
  )
}

/**
 * Writes the curve's lux at each level a threshold is set against, each linked
 * to its decade on the Lux Scale.
 */
export function levelsTable(sky: ClearSky): string {
  return markdownTable(
    ['Moment', "The Sun's Altitude", 'Clear Sky', 'Decade'],
    LEVELS.map(({ altitude, name }) => {
      const lux    = sky.illuminance(altitude)
      const low    = 10 ** Math.floor(Math.log10(lux))
      const decade = `${format.formatLux(low)} to ${format.formatLux(low * 10)} lux`

      return [
        name,
        curve.altitudeWord(altitude),
        `${format.formatLux(lux)} lux`,
        `[${decade}](../sensors/outside.md#nine-decades-of-lux)`
      ]
    })
  )
}

/**
 * Writes the decades as the Markdown table a page keeps for GitHub.
 */
export function luxTable({ date, decades }: DecadeScale): string {
  const rows = decades.map(({ clearSky, day, everyday, range }) => [
    range,
    everyday.map(({ lux, name }) => `${name} at ${lux}`).join(', '),
    clearSky,
    day
  ])

  return markdownTable(['Lux', 'Everyday Light', 'Clear Sky', date], rows)
}

/**
 * Writes the sentences on the night, the moon's figure read off the Lux Scale.
 */
export function nightWords({ decades }: DecadeScale): string {
  const moon  = decades.flatMap(({ everyday }) => everyday).find(({ name }) => name.startsWith('Full moon'))!
  const floor = format.formatLux(luxRange.min)

  return `Moonlight and light pollution sit outside the model. A clear full moon gives ${moon.lux} lux, per `
       + "the [Illuminance table of Wikipedia's Lux article]"
       + '(https://en.wikipedia.org/wiki/Lux#Illuminance), while the reading reaches '
       + "[HomeKit's floor](https://developers.homebridge.io/#/characteristic/CurrentAmbientLightLevel) "
       + `of ${floor} lux before astronomical twilight ends.`
}

/**
 * Writes the sentence that opens The Place Each Request Carries.
 */
export function placeLede({ count }: RoundedPlace): string {
  return 'Each request carries the place rounded to two decimal places, and one forecast cell already spans '
       + `about ${count} of the areas, each holding the points that round to one pair.`
}

/**
 * Writes the drawing's marks as the Markdown table a page keeps for GitHub.
 */
export function placeTable({ marks }: RoundedPlace): string {
  return markdownTable(['Mark', 'Figure'], marks.map(({ name, value }) => [name, value]))
}

/**
 * Writes the sentences on the one request each fetch sends.
 */
export function requestWords({ forecast, past }: typeof REQUEST_TUNING): string {
  return "Each fetch sends one request to [Open-Meteo's forecast API](https://open-meteo.com/en/docs) for "
       + '`shortwave_radiation_instant` under `minutely_15`, covering '
       + `${past} steps before the current step and ${forecast} counted from it, so the window starts `
       + `${format.formatSteps(past)} back and its last step starts `
       + `${format.formatSteps(forecast - 1)} ahead.`
}

/**
 * Writes the replay as the Markdown table a page keeps for GitHub.
 */
export function searchTable({ stages }: SearchReplay): string {
  const rows = stages.map(({ code, label, name, note, shows }) => {
    const sent = code.map((line) => line.trim())
      .join(' ')
      .replaceAll(' &', '&')

    return [name, shows, [label, sent && `\`${sent}\``, note].filter(Boolean).join('. ')]
  })

  return markdownTable(['Stage', 'The Settings Page', 'What Crosses'], rows)
}

/**
 * Writes the rows as the Markdown table a page keeps for GitHub.
 */
export function settingsTable(rows: readonly SettingRow[]): string {
  return markdownTable(
    ['Key', 'Title', 'Type', 'Default', 'What It Does', 'Without It'],
    rows.map(({ does, fallback, key, needed, title, type, without }) => [
      `\`${key}\``,
      title,
      type,
      fallback,
      does,
      `${needed ? 'Needed' : 'Optional'}, and without it, ${without}`
    ])
  )
}

/**
 * Writes the sentence that opens The Sun's Path.
 */
export function sunLede({ lede: { clock, height, opening, share } }: SunYear): string {
  return `On ${opening}, the sun climbs to **${height}** at **${clock}**, ${share} the way from the horizon `
       + 'to straight overhead.'
}

/**
 * Writes the named days of the year as the Markdown table a page keeps for
 * GitHub.
 */
export function sunTable({ days, marks, year }: SunYear): string {
  return markdownTable(
    ['Day', 'Sunrise', 'Highest', 'Sunset'],
    marks.filter(({ named }) => named).map(({ day }) => {
      const sun = days[day]!

      return [
        format.formatDayOfYear(year, day),
        format.formatClock(sun.rise),
        curve.peakWord(sun),
        format.formatClock(sun.set)
      ]
    })
  )
}

/**
 * Writes the levels of a threshold entry as the Markdown list a page keeps for
 * GitHub.
 */
export function thresholdLevels(rows: readonly SettingRow[]): string {
  const prefix = 'thresholds[].'

  return rows.filter(({ key }) => key.startsWith(prefix))
    .map(({ does, key, title }) => `- \`${key.slice(prefix.length)}\`, the ${title} field. ${does}.`)
    .join('\n')
}

/**
 * Writes the sentences on the sample day's one window.
 */
export function windowWords(day: SampleDay): string {
  const [from, to] = day.span

  return `The sample day these pages draw holds one window, ${day.window.times.length} steps from `
       + `${day.clock(from)} to ${day.clock(to)} on ${day.date}, fetched for the zip code `
       + '[Finding Your Place](../install/place.md) searches for. Its minutes outside that span read the '
       + 'clear sky alone.'
}
