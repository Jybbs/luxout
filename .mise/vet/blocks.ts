import type { Block } from './homebridge.ts'

/**
 * The fields of `config.schema.json` the blocks are drawn from.
 */
export interface PluginSchema {
  pluginAlias : string
  schema      : { properties?: Record<string, Property>, required?: string[] }
}

/**
 * A property of `config.schema.json`, in the JSON Schema keywords a sample
 * value reads.
 */
interface Property {
  default?    : unknown
  enum?       : unknown[]
  examples?   : unknown[]
  format?     : string
  items?      : Property
  maxLength?  : number
  maximum?    : number
  minLength?  : number
  minimum?    : number
  oneOf?      : { const?: unknown, enum?: unknown[] }[]
  pattern?    : string
  properties? : Record<string, Property>
  required?   : boolean
  type?       : string
}

/**
 * The value the checks give a string of each JSON Schema `format` they know.
 */
const FORMATS: Record<string, string> = {
  date       : '2024-01-01',
  email      : 'test@example.com',
  hostname   : 'example.com',
  ipv4       : '192.168.1.100',
  ipv6       : '::1',
  mac        : 'AA:BB:CC:DD:EE:FF',
  macaddress : 'AA:BB:CC:DD:EE:FF',
  time       : '12:00:00',
  uri        : 'https://example.com',
  url        : 'https://example.com',
  uuid       : '123e4567-e89b-12d3-a456-426614174000'
}
/**
 * The value the checks give a number where the pattern matches its key, the
 * first match winning.
 */
const NUMBERS: [RegExp, number][] = [
  [/port/i, 8080],
  [/timeout/i, 30],
  [/interval|poll/i, 60],
  [/temperature/i, 22]
]
/**
 * The value the checks start a string from where the pattern matches its key,
 * the first match winning.
 */
const TEXTS: [RegExp, string][] = [
  [/user/i, 'testuser@example.com'],
  [/pass/i, 'testpassword'],
  [/host|server/i, '192.168.1.100'],
  [/email/i, 'test@example.com'],
  [/url|endpoint/i, 'https://api.example.com'],
  [/token|key/i, 'test-api-key-12345']
]

/**
 * A key `config.schema.json` declares beside the property declaring it, valued
 * as Homebridge's verification checks value it.
 */
class Field {
  readonly key       : string
  readonly #property : Property

  /**
   * Builds a field for each key `properties` declares, in the order it lists
   * them.
   */
  static all(properties: Record<string, Property> = {}): Field[] {
    return Object.entries(properties).map(([key, property]) => new Field(key, property))
  }

  constructor(key: string, property: Property) {
    this.key       = key
    this.#property = property
  }

  /**
   * Values the field as the checks value a key of the full block.
   */
  get full(): unknown {
    const { examples, items, maximum, minimum, properties, type } = this.#property
    const value = this.#declared(examples?.[0])

    if (value !== undefined) return value

    switch (type) {
      case 'array'   : return items ? [new Field('item', items).full] : []
      case 'boolean' : return !/debug|verbose/i.test(this.key) && /enable|active/i.test(this.key)
      case 'integer' :
      case 'number'  : return this.#named(NUMBERS) ?? (minimum || maximum || 1)
      case 'object'  : return block(Field.all(properties), 'full')
      case 'string'  : return this.#text
      case undefined :
      default        : return null
    }
  }

  /**
   * Values the field as the checks value a key of the minimal block, reading no
   * `examples`, no key name past a string's, and no bound past `minimum`.
   */
  get minimal(): unknown {
    const value = this.#declared()

    if (value !== undefined) return value

    switch (this.#property.type) {
      case 'array'   : return []
      case 'boolean' : return false
      case 'integer' :
      case 'number'  : return this.#property.minimum || 1
      case 'object'  : return {}
      case 'string'  : return this.#text
      case undefined :
      default        : return null
    }
  }

  get required(): boolean {
    return this.#property.required === true
  }

  /**
   * Values the field as the checks value a string, reading its `enum`, then its
   * `format` or its key, then its lengths, where a string with a `pattern`
   * keeps the value its format or its key gives rather than one generated to
   * match the pattern.
   */
  get #text(): unknown {
    const { enum: options = [], maxLength, minLength = 0, pattern } = this.#property
    const [option] = options

    if (option !== undefined) return option

    const format = this.#property.format?.toLowerCase() ?? ''
    const value  = format === 'date-time'
                 ? new Date().toISOString()
                 : FORMATS[format] ?? this.#named(TEXTS) ?? 'test-value'

    return pattern ? value : value.padEnd(minLength, '0123456789abcdef').slice(0, maxLength)
  }

  /**
   * Picks the value the property declares for itself, reading its `default`,
   * then each of `also`, then the first option `oneOf` lists.
   */
  #declared(...also: unknown[]): unknown {
    const { default: fallback, oneOf = [] } = this.#property
    const [option]                          = oneOf

    return [fallback, ...also, option?.enum?.[0], option?.const].find((value) => value !== undefined)
  }

  #named<T>(table: [RegExp, T][]): T | undefined {
    return table.find(([pattern]) => pattern.test(this.key))?.[1]
  }
}

function block(fields: Field[], value: 'full' | 'minimal'): Block {
  return Object.fromEntries(fields.map((field) => [field.key, field[value]]))
}

/**
 * Draws the blocks Homebridge's verification checks start the plugin under from
 * `config.schema.json`, each key valued as the checks value it.
 *
 * Returns:
 *   The block setting every key the schema declares, and the one setting each
 *   key `required` lists or a property marks required, both beside the
 *   `platform` that `pluginAlias` names.
 */
export function blocks({ pluginAlias, schema }: PluginSchema): { full: Block, minimal: Block } {
  const fields = Field.all(schema.properties).filter(({ key }) => key !== 'platform')
  const needed = fields.filter((field) => field.required || schema.required?.includes(field.key))

  return {
    full    : { platform: pluginAlias, ...block(fields, 'full') },
    minimal : { platform: pluginAlias, ...block(needed, 'minimal') }
  }
}
