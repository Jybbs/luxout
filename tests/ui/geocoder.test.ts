import { expect, it, vi } from 'vitest'

import { Place }     from '../../src/config/place.js'
import { Geocoder }  from '../../src/ui/geocoder.js'
import { Match }     from '../../src/ui/match.js'
import { answering } from '../common/fetch.js'
import search        from './fixtures/search.json' with { type: 'json' }

const ADDRESS = 'https://geocoding-api.open-meteo.com/v1/search?count=10&language=en&name=75001'
const english = new Intl.Locale('en-US')

it('searches every country for the name as typed, in the language of the locale, with no key', async () => {
  const fetch = answering(Response.json(search))

  await new Geocoder(fetch).search(english, '75001')

  expect(fetch).toHaveBeenCalledExactlyOnceWith(ADDRESS, { signal: expect.any(AbortSignal) })
})

it('encodes a name of several words and accents as Open-Meteo decodes it', async () => {
  const fetch = answering(Response.json(search))

  await new Geocoder(fetch).search(english, 'São Paulo')

  expect(fetch.mock.calls[0]?.[0]).toMatch(/&name=S%C3%A3o\+Paulo$/)
})

it('returns each place the search matches, its coordinates rounded to two decimals', async () => {
  const matches = await new Geocoder(answering(Response.json(search))).search(english, '75001')

  expect(matches).toStrictEqual([
    new Match('Paris', new Place(48.85, 2.35), 'France', 'Île-de-France Region'),
    new Match('Addison', new Place(32.96, -96.83), 'United States', 'Texas'),
    new Match('Paris 01 Louvre', new Place(48.86, 2.34), 'France', 'Île-de-France Region')
  ])
})

it('ignores every field Open-Meteo sends beside the ones a match holds', async () => {
  const paris   = { ...search.results[0], elevation: 42, feature_code: 'PPLC', id: 2988507 }
  const fetch   = answering(Response.json({ generationtime_ms: 0.4, results: [paris] }))
  const matches = await new Geocoder(fetch).search(english, 'Paris')

  expect(matches).toStrictEqual([
    new Match('Paris', new Place(48.85, 2.35), 'France', 'Île-de-France Region')
  ])
})

it('returns a match with no region or country where the place carries neither', async () => {
  const body    = { results: [{ latitude: 36.14474, longitude: -5.35257, name: 'Gibraltar' }] }
  const matches = await new Geocoder(answering(Response.json(body))).search(english, 'Gibraltar')

  expect(matches).toStrictEqual([new Match('Gibraltar', new Place(36.14, -5.35))])
})

it('returns no match for an answer carrying no results', async () => {
  const fetch   = answering(Response.json({ generationtime_ms: 0.03 }))
  const matches = await new Geocoder(fetch).search(english, 'B')

  expect(matches).toStrictEqual([])
})

it('reads the count and the timeout from the tuning record it receives', async () => {
  const fetch   = answering(Response.json(search))
  const timeout = vi.spyOn(AbortSignal, 'timeout')

  await new Geocoder(fetch, { count: 3, timeout: 5000 }).search(english, '75001')

  expect(fetch.mock.calls[0]?.[0]).toMatch(/\?count=3&/)
  expect(timeout).toHaveBeenCalledExactlyOnceWith(5000)
})

it('bounds each search by a timeout of 10 seconds', async () => {
  const timeout = vi.spyOn(AbortSignal, 'timeout')

  await new Geocoder(answering(Response.json(search))).search(english, '75001')

  expect(timeout).toHaveBeenCalledExactlyOnceWith(10_000)
})

it('sends each search through the global fetch unless it is given another', async () => {
  const fetch = answering(Response.json(search))

  vi.stubGlobal('fetch', fetch)
  await new Geocoder().search(english, '75001')

  expect(fetch).toHaveBeenCalledOnce()
})

it.each([
  {
    body   : { error: true, reason: 'Parameter count must be between 1 and 100.' },
    line   : 'Open-Meteo answered with an error (status 400, Parameter count must be between 1 and 100.)',
    name   : 'a status Open-Meteo gives a reason for',
    status : 400
  },
  {
    body   : { results: [{ latitude: 48.85341, name: 'Paris' }] },
    line   : 'Open-Meteo sent an answer that fails validation '
           + '(missing_value at .results.0.longitude (missing value))',
    name   : 'a match missing its longitude',
    status : 200
  }
])('reports $name as a failure', async ({ body, line, status }) => {
  const result = await new Geocoder(answering(Response.json(body, { status }))).search(english, '75001')

  expect(result).toMatchObject({ line })
})
