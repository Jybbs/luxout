import { fc, test }   from '@fast-check/vitest'
import { expect, it } from 'vitest'

import { Place } from '../../../src/config/place.js'
import { Match } from '../../../src/ui/public/match.js'

const part = fc.option(fc.string(), { nil: undefined })

it('reaches the page as its name, its region, its country, and its rounded coordinates', () => {
  const match = new Match('Addison', new Place(32.96179, -96.82917), 'United States', 'Texas')

  expect(JSON.stringify(match)).toBe(
      '{"country":"United States","name":"Addison",'
    + '"place":{"latitude":32.96,"longitude":-96.83},"region":"Texas"}'
  )
})

it('reaches the page without the region and the country a place lacks', () => {
  const match = new Match('Gibraltar', new Place(36.14474, -5.35257))

  expect(JSON.stringify(match)).toBe('{"name":"Gibraltar","place":{"latitude":36.14,"longitude":-5.35}}')
})

it.each([
  { country: 'United States', label: 'Addison, Texas, United States', name: 'Addison', region: 'Texas' },
  { country: undefined, label: 'Gibraltar', name: 'Gibraltar', region: undefined },
  { country: 'Vatican', label: 'Vatican City, Vatican', name: 'Vatican City', region: undefined }
])('labels $name as $label, leaving out each part the place lacks', ({ country, label, name, region }) => {
  expect(new Match(name, new Place(0, 0), country, region).label).toBe(label)
})

test.prop([fc.string({ minLength: 1 }), part, part])(
  'opens each label on the name, so the page sets the name apart from the rest',
  (name, region, country) => {
    expect(new Match(name, new Place(0, 0), country, region).label.startsWith(name)).toBe(true)
  }
)
