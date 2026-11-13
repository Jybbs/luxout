import { expect, it } from 'vitest'

import { data } from '../../common/data/debug-line.ts'

const { fields, line } = data

it('writes the line the plugin logs for the resting minute, as the Homebridge log prints it', () => {
  expect(line).toBe([
    '[10/4/2026, 10:00:00 AM] [Luxout] Outside reads 48680 lux from a solar altitude of 31.72°,',
    'a clear-sky illuminance of 54820 lux, and a cloud factor of 0.888 interpolated between',
    '0.9435 at 2026-10-04T13:45:00.000Z and 0.888 at 2026-10-04T14:00:00.000Z'
  ].join(' '))
})

it('finds each field’s value in the line, in the order the line prints them', () => {
  const places = fields.map(({ value }) => line.indexOf(value.replace(/ lux$|°$/, '')))

  expect(places).not.toContain(-1)
  expect(places).toEqual(places.toSorted((a, b) => a - b))
})

it('names the prefix each bridge falls back to where the platform block sets no name', () => {
  expect(fields.find(({ key }) => key === 'prefix')!.note).toBe('The platform block’s name where it sets '
    + 'one, and otherwise the platform name on the main bridge or the package name on a child bridge.')
})
