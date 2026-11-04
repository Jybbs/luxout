import { readFile } from 'node:fs/promises'
import { join }     from 'node:path'

import { expect, it, vi } from 'vitest'

import { Place }        from '../../../../../src/config/place.ts'
import { Geocoder }     from '../../../../../src/ui/geocoder.ts'
import { FetchFailure } from '../../../../../src/weather/failure.ts'
import recording        from '../../../lib/search/recording.json' with { type: 'json' }
import * as replay      from '../../../lib/search/replay.ts'

const markup = await readFile(join(import.meta.dirname, '../../../../../src/ui/public/index.html'), 'utf8')
const { match, url } = await replay.recordSearch()
const shown          = await replay.replaySearch()
const stored         = new Place(recording.results[0]!.latitude, recording.results[0]!.longitude)
const kept           = JSON.parse(shown.stages[3]!.code.join('\n')) as Record<string, unknown>

async function matches(result: object): Promise<unknown> {
  const geocoder = new Geocoder(async () => Response.json({ results: [result] }))

  return geocoder.search(new Intl.Locale('en'), shown.query)
}

it('fails where the recorded answer no longer parses', async () => {
  vi.spyOn(Geocoder.prototype, 'search').mockResolvedValue(new FetchFailure('body', 'unreadable'))

  await expect(replay.recordSearch()).rejects.toThrow('unreadable')
})

it.each(Object.entries(shown.labels))('repeats the settings page’s %s wording', (_, label) => {
  expect(markup).toContain(label)
})

it('requests the query the replay types from the geocoding API', () => {
  expect([url.host, url.pathname, url.searchParams.get('name')])
    .toEqual(['geocoding-api.open-meteo.com', '/v1/search', shown.query])
})

it('stores the coordinates of the recorded result as the plugin rounds them', () => {
  expect(shown.latitude).toBe(String(stored.latitude))
  expect(shown.longitude).toBe(`−${Math.abs(stored.longitude)}`)
})

it('names the place from the name, the region, and the country of the match', () => {
  expect(shown.place).toEqual(['Boston', 'Massachusetts', 'United States'])
})

it('runs the stages from an empty page to the saved block', () => {
  expect(shown.stages.map(({ name }) => name)).toEqual(['Open', 'Type', 'Search', 'Match', 'Confirm', 'Save'])
  expect(shown.stages[0]!.page).toMatchObject({ input: '', match: 'none' })
  expect(shown.stages.at(-1)!.page).toMatchObject({ activity: 'saving', match: 'chosen' })
})

it('holds the typing stage past the last character it types', () => {
  expect(shown.stages[1]!.hold).toBeGreaterThan(shown.query.length * shown.character)
})

it('quotes the request one parameter per line beside its host', () => {
  expect(shown.stages[2]!.code).toEqual([
    'GET /v1/search?count=10',
    '&language=en',
    '&name=02115',
    'Host: geocoding-api.open-meteo.com'
  ])
})

it('writes the block the settings page writes for the match', () => {
  const block = JSON.parse(shown.stages.at(-1)!.code.join('\n'))

  expect(block).toEqual({
    latitude  : stored.latitude,
    longitude : stored.longitude,
    place     : { country: 'United States', name: 'Boston', region: 'Massachusetts' },
    platform  : 'Luxout'
  })
})

it('matches the same place from the fields the note says the server script reads', async () => {
  await expect(matches(kept)).resolves.toEqual([match])
})

it.each(Object.keys(kept))('reads %s from the result', async (key) => {
  const without = Object.fromEntries(Object.entries(kept).filter(([name]) => name !== key))

  await expect(matches(without)).resolves.not.toEqual([match])
})

it('says how many of the recorded fields the server script reads', () => {
  const fields = Object.keys(recording.results[0]!).length

  expect(shown.stages[3]!.note).toBe(
    `It reads 5 of the ${fields} fields in the recorded result and rounds the coordinates to two decimals.`
  )
})
