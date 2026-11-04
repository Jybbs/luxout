import { sort } from 'd3-array'

import schema           from '../../../../config.schema.json' with { type: 'json' }
import { recordSearch } from '../search/replay.ts'

/**
 * The platform block the reference quotes, with its one threshold entry.
 */
interface ExampleBlock extends Readonly<Record<string, unknown>> {
  readonly thresholds : readonly [Readonly<Record<string, unknown>>]
}

/**
 * One run of a block's line, marked for the color the run takes.
 */
interface LineRun {
  readonly kind : 'key' | 'number' | 'punctuation' | 'string'
  readonly text : string
}

interface SchemaNode {
  readonly description  : string
  readonly title        : string
  readonly type         : string
  readonly default?     : number | string
  readonly items?       : { readonly properties: Readonly<Record<string, SchemaNode>> }
  readonly placeholder? : number | string
}

/**
 * One key of the platform block as the Settings Reference lists it.
 */
export interface SettingRow {
  readonly does     : string
  readonly fallback : string
  readonly key      : string
  readonly line     : readonly LineRun[]
  readonly needed   : boolean
  readonly title    : string
  readonly type     : string
  readonly without  : string
}

const JSON_TOKEN                               = /("[^"]*")(\s*:)?|(-?\d+(?:\.\d+)?)|[{}[\],:\s]+/g
const NEEDED: Readonly<Record<string, string>> = {
  'latitude'          : 'the plugin starts nothing and logs the setting it lacks',
  'longitude'         : 'the plugin starts nothing and logs the setting it lacks',
  'platform'          : 'Homebridge skips the block',
  'thresholds[].name' : 'the entry starts no sensor and logs one line'
}
const PLATFORM: SchemaNode = {
  default     : `"${schema.pluginAlias}"`,
  description : 'The platform the block belongs to, which Homebridge reads to hand the block to the plugin',
  title       : 'Not in the form',
  type        : 'string'
}
const { offLux, onLux }                          = schema.schema.properties.thresholds.items.properties
const OPTIONAL: Readonly<Record<string, string>> = {
  'name'                : 'Homebridge logs under the platform’s name',
  'place'               : 'the coordinates stand alone, as they do once typed in by hand',
  'thresholds'          : 'the plugin adds no threshold sensor',
  'thresholds[].offLux' : `the sensor switches off past ${offLux.placeholder} lux`,
  'thresholds[].onLux'  : `the sensor switches on at ${onLux.placeholder} lux`
}

function keysOf(
  properties : Readonly<Record<string, SchemaNode>>,
  prefix     : string = ''
): (readonly [string, SchemaNode])[] {
  return Object.entries(properties).flatMap(([key, node]) => [
    [`${prefix}${key}`, node] as const,
    ...keysOf(node.items?.properties ?? {}, `${prefix}${key}[].`)
  ])
}

function lineOf(block: ExampleBlock, key: string): string {
  const name    = key.slice(key.lastIndexOf('.') + 1)
  const entries = name === key ? block : block.thresholds[0]

  return oneLine({ [name]: entries[name] }).slice(2, -2)
}

function oneLine(value: unknown): string {
  return JSON.stringify(value, null, 1)
    .replaceAll(/\n\s*/g, ' ')
    .replaceAll('[ ', '[')
    .replaceAll(' ]', ']')
}

function runs(line: string): LineRun[] {
  return line.matchAll(JSON_TOKEN)
    .flatMap(([token, text, colon, figure]): LineRun[] => {
      if (text && colon) return [{ kind: 'key', text }, { kind: 'punctuation', text: colon }]
      if (text) return [{ kind: 'string', text }]

      return [{ kind: figure ? 'number' : 'punctuation', text: token }]
    })
    .toArray()
}

/**
 * Builds the platform block the reference quotes, the place from the recorded
 * search and the levels from the placeholders the schema sets.
 */
export async function exampleBlock(): Promise<ExampleBlock> {
  const { block } = await recordSearch()

  return {
    ...block,
    name       : schema.pluginAlias,
    thresholds : [{ name: 'Dark Outside', offLux: offLux.placeholder, onLux: onLux.placeholder }]
  }
}

/**
 * Lists every key `config.schema.json` declares for the block and for a
 * threshold entry, beside `platform`, which `pluginAlias` sets, in alphabetical
 * order.
 */
export async function settingRows(): Promise<SettingRow[]> {
  const block = await exampleBlock()
  const nodes = [['platform', PLATFORM], ...keysOf(schema.schema.properties)] as const

  return sort(nodes, ([key]) => key).map(([key, node]) => ({
    does     : node.description,
    fallback : String(node.default ?? node.placeholder ?? 'None'),
    key      : key,
    line     : runs(lineOf(block, key)),
    needed   : key in NEEDED,
    title    : node.title,
    type     : node.type,
    without  : NEEDED[key] ?? OPTIONAL[key]!
  }))
}
