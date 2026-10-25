import { expect, it } from 'vitest'

import schema          from '../../../config.schema.json' with { type: 'json' }
import { PluginBlock } from '../../../src/ui/public/block.js'
import { Match }       from '../../../src/ui/public/match.js'
import { boston }      from '../../common/places.js'

const BOSTON = { latitude: boston.latitude, longitude: boston.longitude }
const BLOCK  = {
  ...BOSTON,
  _bridge  : { port: 51827, username: '0E:6A:2C:4B:1D:39' },
  name     : 'Daylight',
  place    : { country: 'United States', name: 'Boston', region: 'Massachusetts' },
  platform : 'Luxout'
}
const written = Object.entries(
  PluginBlock.from('Luxout', [])
    .located(BOSTON, new Match('Boston', BOSTON, 'United States', 'Massachusetts'))
    .blocks[0] ?? {}
).filter(([key]) => key !== 'platform')

it('holds the first block the Homebridge UI reports, every key the form writes among them', () => {
  expect(PluginBlock.from('Luxout', [BLOCK, { platform: 'Luxout' }]).blocks).toStrictEqual([BLOCK])
})

it('starts a block on the platform the alias names where the plugin has none yet', () => {
  expect(PluginBlock.from('Luxout', []).blocks).toStrictEqual([{ platform: 'Luxout' }])
})

it('reads the coordinates and the confirmed match the block keeps', () => {
  const block = PluginBlock.from('Luxout', [BLOCK])

  expect(block.coordinates).toStrictEqual(BOSTON)
  expect(block.match).toStrictEqual(new Match('Boston', BOSTON, 'United States', 'Massachusetts'))
})

it.each([
  { block: { latitude: BOSTON.latitude, platform: 'Luxout' }, what: 'a missing longitude' },
  {
    block : { latitude: '42.36', longitude: BOSTON.longitude, platform: 'Luxout' },
    what  : 'a latitude that is not a number'
  },
  { block: { platform: 'Luxout', place: BLOCK.place }, what: 'a place kept with no coordinates' }
])('reads no coordinates and no match from $what', ({ block }) => {
  const read = PluginBlock.from('Luxout', [block])

  expect(read.coordinates).toBeUndefined()
  expect(read.match).toBeUndefined()
})

it.each([
  { place: undefined, what: 'no place' },
  { place: { country: 'United States' }, what: 'a place with no name' }
])('reads the coordinates and no match from a block keeping $what', ({ place }) => {
  const read = PluginBlock.from('Luxout', [{ ...BOSTON, place, platform: 'Luxout' }])

  expect(read.coordinates).toStrictEqual(BOSTON)
  expect(read.match).toBeUndefined()
})

it('keeps the coordinates and the name, region, and country of a match beside every other key', () => {
  const match = new Match('Addison', { latitude: 32.96, longitude: -96.83 }, 'United States', 'Texas')
  const block = PluginBlock.from('Luxout', [BLOCK]).located(match.place, match)

  expect(block.blocks).toStrictEqual([{
    ...BLOCK,
    latitude  : 32.96,
    longitude : -96.83,
    place     : { country: 'United States', name: 'Addison', region: 'Texas' }
  }])
  expect(block.match).toStrictEqual(match)
})

it('keeps typed coordinates with the place sent as undefined, so the UI drops the kept one', () => {
  const block = PluginBlock.from('Luxout', [BLOCK]).located({ latitude: 48.85, longitude: 2.35 })

  expect(block.blocks).toStrictEqual([{ ...BLOCK, latitude: 48.85, longitude: 2.35, place: undefined }])
  expect(block.match).toBeUndefined()
})

it('leaves the block it was located from as it stood', () => {
  const block = PluginBlock.from('Luxout', [BLOCK])

  block.located({ latitude: 48.85, longitude: 2.35 })

  expect(block.blocks).toStrictEqual([BLOCK])
})

it.each(written)('keeps %s, a key it writes, out of view in the generated form', (key, value) => {
  const hidden = { widget: 'hidden' }
  const fields = value instanceof Object ? Object.keys(value).map((field) => [field, hidden]) : []

  expect(schema.schema.properties).toMatchObject({
    [key]: value instanceof Object ? { properties: Object.fromEntries(fields) } : hidden
  })
})
