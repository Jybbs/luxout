import { expect, it } from 'vitest'

import schema       from '../../config.schema.json' with { type: 'json' }
import { Place }    from '../../src/config/place.js'
import { Settings } from '../../src/config/settings.js'
import { boston }   from '../common/places.js'
import homebridge   from '../homebridge/config.json' with { type: 'json' }

const BLOCK      = { latitude: 42.35843, longitude: -71.05977, platform: 'Luxout' }
const properties = Object.entries(schema.schema.properties)
const bounds     = properties.flatMap(([key, property]) => 'minimum' in property ? { key, ...property } : [])

it('holds the place the block names, rounded to two decimals', () => {
  expect(parsed(BLOCK).place).toEqual(new Place(42.36, -71.06))
})

it('holds Boston as the place the Luxout block of the test config names', () => {
  const block = homebridge.platforms.find(({ platform }) => platform === schema.pluginAlias)

  expect(parsed(block).place).toEqual(boston)
})

it.each([
  { name: 'Daylight', what: 'a name' },
  { name: 5,          what: 'a name that is not a string' }
])('passes the keys Homebridge reads from a block, $what among them, unread', ({ name }) => {
  const block = { ...BLOCK, _bridge: { port: 51827, username: '0E:6A:2C:4B:1D:39' }, name }

  expect(parsed(block).place).toEqual(parsed(BLOCK).place)
})

it.each(bounds.map(({ key }) => key))('fails a block whose %s is null', (key) => {
  expect(Settings.parse({ ...BLOCK, [key]: null })).toMatchObject({ issues: [{ path: [key] }], ok: false })
})

it.each(bounds.map(({ key }) => key))('fails a block missing its %s', (key) => {
  const block = Object.fromEntries(Object.entries(BLOCK).filter(([name]) => name !== key))

  expect(Settings.parse(block)).toMatchObject({ issues: [{ code: 'missing_value', path: [key] }], ok: false })
})

it.each(bounds.flatMap(({ key, maximum, minimum }) => [
  { holds: true,  key, value: minimum },
  { holds: true,  key, value: maximum },
  { holds: false, key, value: minimum - 1e-9 },
  { holds: false, key, value: maximum + 1e-9 }
]))('accepts $key at $value only inside the bounds config.schema.json declares', ({ holds, key, value }) => {
  expect(Settings.parse({ ...BLOCK, [key]: value }).ok).toBe(holds)
})

function parsed(config: unknown): Settings {
  const result = Settings.parse(config)

  return result.ok ? result.value : result.throw()
}
