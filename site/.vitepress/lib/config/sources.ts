import { REQUEST_TUNING }    from '../../../../src/weather/client.ts'
import type { Bibliography } from '../citations/bibliography.ts'
import { CREDIT }            from '../credit/credit.ts'
import { formatSteps }       from '../daylight/format.ts'

/**
 * One source as the site lists it, its address read from the bibliography's
 * entry under `cite` wherever the bibliography holds the work.
 */
type Listed = Omit<Source, 'link'> & ({ cite: string } | { link: string })

/**
 * One source the reading rests on, with what it supplies, the terms the site
 * credits it under, and the mark and color the front page draws it in.
 */
export interface Source {
  link  : string
  mark  : 'arc' | 'bars' | 'bell' | 'curve' | 'pin'
  name  : string
  role  : string
  says  : string
  terms : string
  tone  : 'area' | 'forecast' | 'geometry' | 'muted' | 'sky'
}

const SOURCES: readonly Listed[] = [
  {
    link  : 'https://open-meteo.com/en/docs',
    mark  : 'bars',
    name  : 'Open-Meteo',
    role  : 'The forecast',
    says  : `Sunlight at the ground every ${formatSteps(1)}, ${formatSteps(REQUEST_TUNING.forecast)} ahead, `
          + 'fetched once an hour.',
    terms : `Data ${CREDIT.license.text}`,
    tone  : 'forecast'
  },
  {
    cite  : 'geonames',
    mark  : 'pin',
    name  : 'GeoNames',
    role  : 'The place',
    says  : 'The town a zip code or a city resolves to, through Open-Meteo’s geocoding API.',
    terms : 'Data CC BY 4.0',
    tone  : 'muted'
  },
  {
    link  : 'https://www.npmjs.com/package/astronomy-engine',
    mark  : 'arc',
    name  : 'astronomy-engine',
    role  : 'The sun’s position',
    says  : 'The sun’s altitude at the stored place, computed every minute on the bridge.',
    terms : 'MIT License',
    tone  : 'geometry'
  },
  {
    cite  : 'janiczek1987',
    mark  : 'curve',
    name  : 'Circular 171',
    role  : 'The clear-sky curve',
    says  : 'The U.S. Naval Observatory’s lux from the sun and sky, through day and twilight alike.',
    terms : 'U.S. Government work',
    tone  : 'sky'
  },
  {
    cite  : 'reno2012',
    mark  : 'bell',
    name  : 'Haurwitz',
    role  : 'The clear-sky irradiance',
    says  : 'The clear sky’s W/m² the forecast is divided by, per Sandia report SAND2012-2389.',
    terms : 'U.S. Department of Energy report',
    tone  : 'area'
  }
]

/**
 * Lists the sources the reading rests on in the order the front page sets them
 * out, each address read from `bibliography` where the source cites a work.
 */
export function sourcesFrom(bibliography: Bibliography): Source[] {
  return SOURCES.map((listed) => {
    if ('link' in listed) return listed

    const { cite, ...source } = listed

    return { ...source, link: bibliography.address(cite) }
  })
}
