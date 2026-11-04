import { expect, it } from 'vitest'

import schema       from '../../../../../config.schema.json' with { type: 'json' }
import { Settings } from '../../../../../src/config/settings.ts'
import * as rows    from '../../../lib/settings/rows.ts'

const block     = await rows.exampleBlock()
const listed    = await rows.settingRows()
const blockKeys = listed.filter(({ key }) => key !== 'platform' && !key.includes('[]'))
const byKey     = new Map(listed.map((row) => [row.key, row]))
const [entry]   = block.thresholds
const entryKeys = listed.filter(({ key }) => key.startsWith('thresholds[].'))

function entryWithout(name: string): ReturnType<typeof Settings.parse> {
  return Settings.parse({ ...block, thresholds: [{ ...entry, [name]: undefined }] })
}

it('lists every key of the schema beside the platform key, alphabetically', () => {
  expect(listed.map(({ key }) => key)).toEqual([
    'latitude',
    'longitude',
    'name',
    'place',
    'platform',
    'thresholds',
    'thresholds[].name',
    'thresholds[].offLux',
    'thresholds[].onLux'
  ])
})

it('reads each title and description from the schema', () => {
  const { latitude, thresholds } = schema.schema.properties

  expect(byKey.get('latitude')).toMatchObject({ does: latitude.description, title: latitude.title })
  expect(byKey.get('thresholds[].onLux')).toMatchObject({
    does  : thresholds.items.properties.onLux.description,
    title : thresholds.items.properties.onLux.title
  })
})

it('gives every key a description and a sentence on what happens without it', () => {
  expect(listed.filter(({ does, without }) => !does || !without)).toEqual([])
})

it('takes each default from the schema, the placeholder a level falls back to included', () => {
  const { offLux, onLux } = schema.schema.properties.thresholds.items.properties
  const keys              = ['latitude', 'platform', 'thresholds[].offLux', 'thresholds[].onLux']

  expect(keys.map((key) => byKey.get(key)!.fallback))
    .toEqual(['None', `"${schema.pluginAlias}"`, String(offLux.placeholder), String(onLux.placeholder)])
})

it('writes each row’s words as plain text, which the card renders without Markdown', () => {
  expect(listed.filter(({ does, without }) => `${does}${without}`.includes('`'))).toEqual([])
})

it('marks the platform key needed, which Homebridge reads to hand the block to the plugin', () => {
  expect(byKey.get('platform')!.needed).toBe(true)
})

it.each(blockKeys)('fails a block without $key only where its row says needed', ({ key, needed }) => {
  expect(Settings.parse({ ...block, [key]: undefined }).ok).toBe(!needed)
})

it.each(entryKeys)('faults an entry without $key only where its row says needed', ({ key, needed }) => {
  const settings = entryWithout(key.replace('thresholds[].', ''))

  expect(settings.ok && settings.value.faults.length === 1).toBe(needed)
})

it.each(['offLux', 'onLux'] as const)('fills a left-out %s with the level its row names', (level) => {
  const settings = entryWithout(level)
  const filled   = settings.ok ? settings.value.thresholds[0]![level] : undefined

  expect(byKey.get(`thresholds[].${level}`)!.without).toContain(`${filled} lux`)
})

it('quotes a block the plugin parses with no fault', () => {
  const settings = Settings.parse(block)

  expect(settings.ok && settings.value.faults).toEqual([])
})

it('splits a key’s line into runs that read back as the line', () => {
  expect(byKey.get('latitude')!.line.map(({ kind, text }) => [kind, text])).toEqual([
    ['key', '"latitude"'],
    ['punctuation', ':'],
    ['punctuation', ' '],
    ['number', '42.36']
  ])
})

it('quotes one threshold entry on its one line', () => {
  const line = byKey.get('thresholds')!.line.map(({ text }) => text).join('')

  expect(line).toBe('"thresholds": [{ "name": "Dark Outside", "offLux": 662, "onLux": 2.99 }]')
})
