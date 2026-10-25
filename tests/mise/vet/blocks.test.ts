import { expect, it, vi } from 'vitest'

import { type PluginSchema, blocks } from '../../../.mise/vet/blocks.ts'

/**
 * Values every key `properties` declares as the full block does.
 */
function full(properties: PluginSchema['schema']['properties']): unknown {
  return blocks({ pluginAlias: 'Luxout', schema: { properties } }).full
}

/**
 * Values each key `properties` marks required as the minimal block does.
 */
function minimal(properties: PluginSchema['schema']['properties']): unknown {
  return blocks({ pluginAlias: 'Luxout', schema: { properties } }).minimal
}

it('values the minimal block by the checks’ plainer rules, keeping each key required either way', () => {
  const plugin = {
    pluginAlias : 'Luxout',
    schema      : {
      required   : ['missing', 'tags'],
      properties : {
        count   : { maximum: 5, required: true, type: 'number' },
        enabled : { required: true, type: 'boolean' },
        name    : { type: 'string' },
        tags    : { items: { type: 'string' }, type: 'array' }
      }
    }
  }

  expect(blocks(plugin).minimal).toEqual({ count: 1, enabled: false, platform: 'Luxout', tags: [] })
})

it('keeps the platform alias in both blocks where the schema declares a platform key', () => {
  const platform = { required: true, type: 'string' }

  expect(blocks({ pluginAlias: 'Luxout', schema: { properties: { platform } } }))
    .toEqual({ full: { platform: 'Luxout' }, minimal: { platform: 'Luxout' } })
})

it.each([
  { property: { default: 3, type: 'number' }, value: 3 },
  { property: { examples: ['a', 'b'], type: 'string' }, value: 'a' },
  { property: { oneOf: [{ enum: ['up', 'down'] }], type: 'string' }, value: 'up' },
  { property: { oneOf: [{ const: 'north' }], type: 'string' }, value: 'north' },
  { property: { enum: ['east', 'west'], type: 'string' }, value: 'east' },
  { property: { enum: [2, 3], type: 'number' }, value: 1 },
  { property: { type: 'string' }, value: 'test-value' },
  { property: { format: 'IPv4', type: 'string' }, value: '192.168.1.100' },
  { property: { minLength: 12, type: 'string' }, value: 'test-value01' },
  { property: { maxLength: 4, type: 'string' }, value: 'test' },
  { property: { minLength: 12, pattern: '^t', type: 'string' }, value: 'test-value' },
  { property: { maximum: 9, minimum: 0, type: 'integer' }, value: 9 },
  { property: { minimum: 4, type: 'number' }, value: 4 },
  { property: { type: 'number' }, value: 1 },
  { property: { type: 'array' }, value: [] },
  { property: { items: { type: 'number' }, type: 'array' }, value: [1] },
  { property: { properties: { on: { type: 'number' } }, type: 'object' }, value: { on: 1 } },
  { property: {}, value: null },
  { property: { type: 'null' }, value: null }
])('values $property as the checks value it', ({ property, value }) => {
  expect(full({ setting: property })).toEqual({ platform: 'Luxout', setting: value })
})

it.each([
  { key: 'enableDebug', type: 'boolean', value: false },
  { key: 'activeHours', type: 'boolean', value: true },
  { key: 'verbose', type: 'boolean', value: false },
  { key: 'shown', type: 'boolean', value: false },
  { key: 'port', type: 'integer', value: 8080 },
  { key: 'requestTimeout', type: 'number', value: 30 },
  { key: 'pollInterval', type: 'number', value: 60 },
  { key: 'targetTemperature', type: 'number', value: 22 },
  { key: 'username', type: 'string', value: 'testuser@example.com' },
  { key: 'password', type: 'string', value: 'testpassword' },
  { key: 'serverAddress', type: 'string', value: '192.168.1.100' },
  { key: 'email', type: 'string', value: 'test@example.com' },
  { key: 'webhookUrl', type: 'string', value: 'https://api.example.com' },
  { key: 'apiToken', type: 'string', value: 'test-api-key-12345' }
])('values a $type named $key as $value', ({ key, type, value }) => {
  expect(full({ [key]: { type } })).toEqual({ [key]: value, platform: 'Luxout' })
})

it.each([
  { property: { default: 3, type: 'number' }, value: 3 },
  { property: { oneOf: [{ const: 'north' }], type: 'string' }, value: 'north' },
  { property: { examples: ['a'], type: 'string' }, value: 'test-value' },
  { property: { items: { type: 'number' }, type: 'array' }, value: [] },
  { property: { type: 'boolean' }, value: false },
  { property: { maximum: 9, type: 'integer' }, value: 1 },
  { property: { minimum: 4, type: 'number' }, value: 4 },
  { property: { properties: { on: { type: 'number' } }, type: 'object' }, value: {} },
  { property: { format: 'email', type: 'string' }, value: 'test@example.com' },
  { property: {}, value: null },
  { property: { type: 'null' }, value: null }
])('values a required $property as the checks value a key of the minimal block', ({
  property,
  value
}) => {
  expect(minimal({ setting: { ...property, required: true } }))
    .toEqual({ platform: 'Luxout', setting: value })
})

it('values an array’s item under the key `item`, as the checks do', () => {
  expect(full({ ports: { items: { type: 'integer' }, type: 'array' } }))
    .toEqual({ platform: 'Luxout', ports: [1] })
})

it('values a date-time string at the instant the blocks are built', ({ onTestFinished }) => {
  vi.setSystemTime(new Date('2026-06-21T12:00:00Z'))
  onTestFinished(() => {
    vi.useRealTimers()
  })

  expect(full({ setting: { format: 'date-time', type: 'string' } }))
    .toEqual({ platform: 'Luxout', setting: '2026-06-21T12:00:00.000Z' })
})
