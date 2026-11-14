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

export const SOURCES: readonly Source[] = [
  {
    link  : 'https://open-meteo.com/en/docs',
    mark  : 'bars',
    name  : 'Open-Meteo',
    role  : 'The forecast',
    says  : 'Sunlight at the ground every 15 minutes, six hours ahead, fetched once an hour.',
    terms : 'Data CC BY 4.0',
    tone  : 'forecast'
  },
  {
    link  : 'https://www.geonames.org/',
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
    link  : 'https://archive.org/details/DTIC_ADA182110',
    mark  : 'curve',
    name  : 'Circular 171',
    role  : 'The clear-sky curve',
    says  : 'The U.S. Naval Observatory’s lux from the sun and sky, through day and twilight alike.',
    terms : 'U.S. Government work',
    tone  : 'sky'
  },
  {
    link  : 'https://doi.org/10.2172/1039404',
    mark  : 'bell',
    name  : 'Haurwitz',
    role  : 'The clear-sky irradiance',
    says  : 'The clear sky’s W/m² the forecast is divided by, per Sandia report SAND2012-2389.',
    terms : 'Published model',
    tone  : 'area'
  }
]
