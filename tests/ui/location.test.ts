import { RequestError }   from '@homebridge/plugin-ui-utils'
import { expect, it, vi } from 'vitest'

import { Place }           from '../../src/config/place.js'
import { Geocoder }        from '../../src/ui/geocoder.js'
import { LocationService } from '../../src/ui/location.js'
import { Match }           from '../../src/ui/public/match.js'
import { answering }       from '../common/fetch.js'
import search              from './fixtures/search.json' with { type: 'json' }

const BOUNDS = 'Coordinates take a latitude from -90 to 90 and a longitude from -180 to 180'

it('returns the place typed coordinates round to, ignoring the other keys of the block', () => {
  const place = service().check({ latitude: 42.35843, longitude: -71.05977, platform: 'Luxout' })

  expect(place).toStrictEqual(new Place(42.36, -71.06))
})

it.each([
  { payload: { latitude: 90.001, longitude: 0 }, what: 'a latitude past the pole' },
  { payload: { latitude: 0, longitude: -180.001 }, what: 'a longitude past the antimeridian' },
  { payload: { latitude: '42.36', longitude: -71.06 }, what: 'a latitude that is not a number' },
  { payload: { latitude: 42.36 }, what: 'a missing longitude' },
  { payload: null, what: 'no coordinates at all' }
])('fails $what with the bounds config.schema.json declares', ({ payload }) => {
  expect(() => service().check(payload)).toThrow(new RequestError(BOUNDS, expect.any(Array)))
})

it('returns the places a search matches, ignoring the other keys of the request', async () => {
  const matches = await service().search({ language: 'en', platform: 'Luxout', query: '75001' })

  expect(matches.map(({ country, name }) => `${name}, ${country}`))
    .toStrictEqual(['Paris, France', 'Addison, United States', 'Paris 01 Louvre, France'])
})

it.each([
  { language: 'en', tag: 'EN' },
  { language: 'pt', tag: 'pt-BR' },
  { language: 'zh', tag: 'zh-CN' }
])('searches in $language for the language $tag the Homebridge UI runs in', async ({ language, tag }) => {
  const fetch = answering(Response.json(search))

  await service(fetch).search({ language: tag, query: '75001' })

  expect(fetch.mock.calls[0]?.[0]).toContain(`&language=${language}&`)
})

it('fails a search matching nothing with a hint to search by the city’s name', async () => {
  const query   = 'SW1A 1AA'
  const pending = service(answering(Response.json({}))).search({ language: 'en', query })

  await expect(pending).rejects.toStrictEqual(
    new RequestError(`No place matches “${query}”, so search by the city’s name instead`, { query })
  )
})

it('sends a blank search as typed and fails it with the hint quoting the empty query', async () => {
  const fetch   = answering(Response.json({ generationtime_ms: 0.03 }))
  const pending = service(fetch).search({ language: 'en', query: '' })

  await expect(pending).rejects.toStrictEqual(
    new RequestError('No place matches “”, so search by the city’s name instead', { query: '' })
  )
  expect(fetch).toHaveBeenCalledOnce()
})

it('fails the search with the failure’s one line where the request to Open-Meteo fails', async () => {
  const fetch   = answering(new Response('Bad Gateway', { status: 502 }))
  const pending = service(fetch).search({ language: 'en', query: '75001' })

  await expect(pending).rejects.toStrictEqual(
    new RequestError(
      'Open-Meteo answered with an error (status 502)',
      expect.objectContaining({ kind: 'status' })
    )
  )
})

it.each([
  { message: 'missing_value at .query (missing value)', payload: { language: 'en' } },
  { message: 'invalid_type at .query (expected string)', payload: { language: 'en', query: 75001 } },
  { message: 'custom_error at .language (not a language tag)', payload: { language: 'e', query: '75001' } },
  { message: 'invalid_type at . (expected object)', payload: undefined }
])('fails a malformed search, sending nothing, as $message', async ({ message, payload }) => {
  const fetch = answering(Response.json(search))

  await expect(service(fetch).search(payload))
    .rejects.toStrictEqual(new RequestError(message, expect.any(Array)))
  expect(fetch).not.toHaveBeenCalled()
})

it('searches through a geocoder on the global fetch unless it is given another', async () => {
  const fetch = answering(Response.json(search))

  vi.stubGlobal('fetch', fetch)

  await expect(new LocationService().search({ language: 'en', query: '75001' }))
    .resolves.toContainEqual(expect.any(Match))
  expect(fetch).toHaveBeenCalledOnce()
})

function service(fetch = answering(Response.json(search))): LocationService {
  return new LocationService(new Geocoder(fetch))
}
