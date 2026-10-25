import { fc, test }       from '@fast-check/vitest'
import * as hap           from '@homebridge/hap-nodejs'
import { expect, it, vi } from 'vitest'

import schema                             from '../../config.schema.json' with { type: 'json' }
import { ThresholdEntry, ThresholdFault } from '../../src/config/threshold.js'
import { ClearSky }                       from '../../src/daylight/clear-sky.js'
import { thresholdEntry }                 from '../common/threshold.js'

const GLARE  = { name: 'Glare', offLux: 20000, onLux: 30000 }
const fields = schema.schema.properties.thresholds.items.properties
const lux    = fc.double({ max: 100000, min: 0.0001, noNaN: true })
const DARK   = { name: 'Dark Outside', offLux: fields.offLux.placeholder, onLux: fields.onLux.placeholder }
const levels = Object.entries(fields).flatMap(([key, field]) => 'minimum' in field ? { key, ...field } : [])

it('holds the name and both levels an entry sets', () => {
  expect(thresholdEntry(GLARE)).toMatchObject(GLARE)
})

it('holds an entry carrying a key it does not read', () => {
  expect(thresholdEntry({ ...GLARE, levelLux: 400 })).toMatchObject(GLARE)
})

it('takes the Dark Outside levels where an entry sets no level', () => {
  expect(thresholdEntry({ name: 'Dark Outside' })).toMatchObject(DARK)
})

it.each([
  { altitude: -6,     key: 'onLux',  moment: 'the end of civil twilight' },
  { altitude: -5 / 6, key: 'offLux', moment: 'sunset' }
] as const)('shows as the default $key the clear-sky curve at $moment', ({ altitude, key }) => {
  expect(fields[key].placeholder).toBe(Number(new ClearSky().illuminance(altitude).toPrecision(3)))
})

it.each(levels.flatMap(({ key, maximum, minimum }) => [
  { holds: true,  key, value: minimum },
  { holds: true,  key, value: maximum },
  { holds: false, key, value: minimum / 2 },
  { holds: false, key, value: maximum + 1e-9 }
]))('accepts $key at $value only inside the bounds config.schema.json declares', ({ holds, key, value }) => {
  const result = ThresholdEntry.parse({ ...GLARE, [key]: value }, 0)

  expect(result instanceof ThresholdEntry).toBe(holds)
})

it.each(levels)('bounds $key to the range CurrentAmbientLightLevel accepts', ({ maximum, minimum }) => {
  const { props } = new hap.Characteristic.CurrentAmbientLightLevel()

  expect({ maximum, minimum }).toEqual({ maximum: props.maxValue, minimum: props.minValue })
})

it('caps the name so the serial it gives fits the length SerialNumber accepts', () => {
  const name   = 'N'.repeat(fields.name.maxLength)
  const length = new hap.Characteristic.SerialNumber().props.maxLen

  expect(thresholdEntry({ name }).serial).toHaveLength(Number(length))
  expect(ThresholdEntry.parse({ name: `${name}N` }, 0)).toBeInstanceOf(ThresholdFault)
})

it.each([
  'Dark Outside', 'Café 2', "Jo's Porch, East", 'D', ' Dusk', 'Dusk!', 'Dusk 🌙'
])('accepts the name %s only where HAP-NodeJS accepts it', (name) => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

  new hap.Service.OccupancySensor(name)

  expect(ThresholdEntry.parse({ name }, 0) instanceof ThresholdEntry).toBe(warn.mock.calls.length === 0)
})

it('derives the serial of an entry from its name alone, whatever its levels', () => {
  const { serial } = thresholdEntry({ name: 'Dusk' })

  expect(thresholdEntry({ name: 'Dusk', offLux: 900, onLux: 400 }).serial).toBe(serial)
  expect(thresholdEntry({ name: 'Dawn' }).serial).not.toBe(serial)
})

it.each([
  {
    line : 'Dusk starts no sensor until its settings hold a valid onLux',
    raw  : { name: 'Dusk', onLux: -1 }
  },
  {
    line : 'Dusk starts no sensor until its settings hold a valid offLux and onLux',
    raw  : { name: 'Dusk', offLux: 'dim', onLux: 0 }
  },
  {
    line : 'Threshold 3 starts no sensor until its settings hold a valid name',
    raw  : { onLux: 400 }
  },
  {
    line : 'Threshold 3 starts no sensor until its settings hold a valid name',
    raw  : { name: '' }
  },
  {
    line : 'Dusk starts no sensor until its onLux and offLux differ',
    raw  : { name: 'Dusk', offLux: 400, onLux: 400 }
  }
])('fails $raw with the one line naming the entry and the setting at fault', ({ line, raw }) => {
  expect(ThresholdEntry.parse(raw, 2)).toMatchObject({ line })
})

it('keeps the serial of a failing entry whose name parses, and none where its name fails', () => {
  const { serial } = thresholdEntry({ name: 'Dusk' })

  expect(ThresholdEntry.parse({ name: 'Dusk', onLux: -1 }, 0)).toMatchObject({ serial })
  expect(ThresholdEntry.parse({ onLux: 400 }, 0)).toMatchObject({ serial: undefined })
})

it.each([
  { detected: false, lux: 2.99,  next: true,  where: 'at its on level' },
  { detected: false, lux: 3,     next: false, where: 'just above its on level' },
  { detected: true,  lux: 662,   next: true,  where: 'at its off level' },
  { detected: true,  lux: 662.1, next: false, where: 'just past its off level' }
])('switches a falling sensor detecting $detected to $next $where', ({ detected, lux, next }) => {
  expect(thresholdEntry(DARK).detects(detected, lux)).toBe(next)
})

it.each([
  { detected: false, lux: 30000,   next: true,  where: 'at its on level' },
  { detected: false, lux: 29999.9, next: false, where: 'just below its on level' },
  { detected: true,  lux: 20000,   next: true,  where: 'at its off level' },
  { detected: true,  lux: 19999.9, next: false, where: 'just past its off level' }
])('switches a rising sensor detecting $detected to $next $where', ({ detected, lux, next }) => {
  expect(thresholdEntry(GLARE).detects(detected, lux)).toBe(next)
})

test.prop([lux, lux, fc.boolean(), fc.double({ max: 1, min: 0, noNaN: true })])(
  'holds its state while the reading stays inside the gap between its levels',
  (offLux, onLux, detected, share) => {
    const low  = Math.min(offLux, onLux)
    const high = Math.max(offLux, onLux)
    const gap  = low + (high - low) * share

    fc.pre(low < gap && gap < high)

    expect(thresholdEntry({ name: 'Gap', offLux, onLux }).detects(detected, gap)).toBe(detected)
  }
)

test.prop([lux, lux, fc.boolean()])(
  'switches on at its on level whatever state it holds',
  (offLux, onLux, detected) => {
    fc.pre(offLux !== onLux)

    expect(thresholdEntry({ name: 'On', offLux, onLux }).detects(detected, onLux)).toBe(true)
  }
)
