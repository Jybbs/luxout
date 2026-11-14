import { join } from 'node:path'

import schema           from '../../../../config.schema.json' with { type: 'json' }
import { Geocoder }     from '../../../../src/ui/geocoder.ts'
import { PluginBlock }  from '../../../../src/ui/public/block.ts'
import type { Match }   from '../../../../src/ui/public/match.ts'
import { FetchFailure } from '../../../../src/weather/failure.ts'
import { signed }       from '../daylight/format.ts'
import recording        from './recording.json' with { type: 'json' }

/**
 * The look of the replayed settings page at one stage of a search.
 */
export interface SearchPage {
  readonly input     : string
  readonly match     : 'chosen' | 'listed' | 'none'
  readonly activity? : 'saving' | 'spinning' | 'typing'
}

/**
 * The replay the Location Search draws.
 */
export interface SearchReplay {
  readonly character : number  // Milliseconds per character the replay types
  readonly field     : string
  readonly labels    : typeof LABELS
  readonly latitude  : string
  readonly longitude : string
  readonly place     : readonly string[]
  readonly query     : string
  readonly stages    : readonly SearchStage[]
}

/**
 * One stage of the replayed search, with what crosses the wire at that stage. A
 * file name in `label` or `note` sits between backticks.
 */
export interface SearchStage {
  readonly code  : readonly string[]
  readonly hold  : number  // Milliseconds the stage holds before the next one opens
  readonly label : string
  readonly name  : string
  readonly note  : string
  readonly page  : SearchPage
  readonly shows : string
}

const CHARACTER        = 120   // Milliseconds
const HOLD             = 1400  // Milliseconds a stage past the typing holds
const IDLE: SearchPage = { input: '', match: 'none' }
const KEPT             = ['name', 'latitude', 'longitude', 'admin1', 'country'] as const
/**
 * The words the settings page shows, which the replayed page repeats.
 */
const LABELS = {
  attribution : 'Attribution',
  button      : 'Search',
  empty       : 'Matches appear here',
  geonames    : 'Location data from GeoNames',
  latitude    : 'Latitude',
  license     : 'CC BY 4.0',
  longitude   : 'Longitude',
  matches     : 'Matches',
  none        : 'No place kept yet',
  place       : 'Place',
  placeholder : '02115 or Boston',
  search      : 'Zip code, city, or coordinates',
  under       : 'under',
  weather     : 'Weather data by Open-Meteo.com'
} as const
/**
 * What crosses at a stage that sends no request.
 */
const NOTHING = {
  code  : [],
  label : 'Nothing sent',
  note  : 'The page reads the platform block, empty until the plugin is configured, '
        + 'and sends no search until you ask for one.'
}
const OPEN_HOLD = 800  // Milliseconds the first stage holds
const QUERY     = '02115'
const TYPE_HOLD = 500  // Milliseconds the typing stage holds past its last character
/**
 * The path of each file the replay reads, which the settings and search loaders
 * both watch.
 */
export const replaySources = ['../../../../config.schema.json', './recording.json']
  .map((path) => join(import.meta.dirname, path))
const result = recording.results[0]!

function jsonLines(value: unknown): string[] {
  return JSON.stringify(value, null, 2).split('\n')
}

/**
 * Sends the search through the plugin's `Geocoder` against the recorded answer.
 *
 * Returns:
 *   The address the client requested beside the first match and the block the
 *   settings page writes for it, each from the plugin's own code with no
 *   network.
 */
export async function recordSearch(): Promise<{ block: object, match: Match, url: URL }> {
  const requests: string[] = []

  const found = await new Geocoder(async (input) => {
    requests.push(new Request(input).url)

    return Response.json(recording)
  }).search(new Intl.Locale('en'), QUERY)

  if (found instanceof FetchFailure) throw new Error(found.line)

  const match   = found[0]!
  const [block] = PluginBlock.from(schema.pluginAlias, []).located(match.place, match).blocks

  return { block: block!, match, url: new URL(requests[0]!) }
}

/**
 * Sets out the replay stage by stage, from the page's opening state to the
 * block Save writes.
 */
export async function replaySearch(): Promise<SearchReplay> {
  const { block, match, url } = await recordSearch()
  const blockLines            = jsonLines(block)
  const typed                 = { ...IDLE, input: QUERY }
  const chosen                = { ...typed, match: 'chosen' } as const
  const kept                  = Object.fromEntries(KEPT.map((key) => [key, result[key]]))

  return {
    character : CHARACTER,
    field     : schema.schema.properties.name.title,
    labels    : LABELS,
    latitude  : signed(match.place.latitude),
    longitude : signed(match.place.longitude),
    place     : match.label.split(', '),
    query     : QUERY,
    stages    : [
      {
        ...NOTHING,
        hold  : OPEN_HOLD,
        name  : 'Open',
        page  : IDLE,
        shows : 'The search field empty and no place kept'
      },
      {
        ...NOTHING,
        hold  : TYPE_HOLD + QUERY.length * CHARACTER,
        name  : 'Type',
        page  : { ...typed, activity: 'typing' },
        shows : `The zip code \`${QUERY}\` in the search field`
      },
      {
        code  : `GET ${url.pathname}${url.search.replaceAll('&', '\n&')}\nHost: ${url.host}`.split('\n'),
        hold  : HOLD,
        label : 'The search the server script sends',
        name  : 'Search',
        note  : 'It leaves from the Homebridge host rather than from the browser.',
        page  : { ...typed, activity: 'spinning' },
        shows : 'The spinner over the page'
      },
      {
        code  : jsonLines(kept),
        hold  : HOLD,
        label : 'The fields the server script reads',
        name  : 'Match',
        note  : `It reads ${KEPT.length} of the ${Object.keys(result).length} fields in the recorded result `
              + 'and rounds the coordinates to two decimals.',
        page  : { ...typed, match: 'listed' },
        shows : `${match.label} under Matches`
      },
      {
        code  : blockLines,
        hold  : HOLD,
        label : 'The block passed to the Homebridge UI',
        name  : 'Confirm',
        note  : 'Nothing is written yet, so closing the settings without Save leaves `config.json` '
              + 'as it was.',
        page  : chosen,
        shows : 'The latitude, the longitude, and the place kept beside the search'
      },
      {
        code  : blockLines,
        hold  : HOLD,
        label : 'The block in `config.json`',
        name  : 'Save',
        note  : '',
        page  : { ...chosen, activity: 'saving' },
        shows : 'Save pressed'
      }
    ]
  }
}
