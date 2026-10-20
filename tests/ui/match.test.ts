import { expect, it } from 'vitest'

import { Place } from '../../src/config/place.js'
import { Match } from '../../src/ui/match.js'

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
