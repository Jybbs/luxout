import { pathToFileURL } from 'node:url'

import { expect, it } from 'vitest'

import { Bibliography } from '../../../lib/citations/bibliography.ts'
import { sourcesFrom }  from '../../../lib/config/sources.ts'

const bibliography = await Bibliography.read(pathToFileURL(`${import.meta.dirname}/../../../`))

it('links each source to the address its bibliography entry gives, keeping the rest as listed', () => {
  expect(Object.fromEntries(sourcesFrom(bibliography).map(({ link, name }) => [name, link]))).toEqual({
    'Circular 171'     : bibliography.address('janiczek1987'),
    'GeoNames'         : bibliography.address('geonames'),
    'Haurwitz'         : bibliography.address('reno2012'),
    'Open-Meteo'       : 'https://open-meteo.com/en/docs',
    'astronomy-engine' : 'https://www.npmjs.com/package/astronomy-engine'
  })
})

it('fails naming a source whose work the bibliography holds no entry for', () => {
  expect(() => sourcesFrom(new Bibliography(new Map())))
    .toThrow('The bibliography holds no entry for geonames')
})
