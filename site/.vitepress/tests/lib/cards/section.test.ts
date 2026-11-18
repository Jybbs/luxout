/** @module-tag draws */
import { expect, it } from 'vitest'

import { Faces }              from '../../../lib/cards/faces.ts'
import { readPalette }        from '../../../lib/cards/palette.ts'
import { HOURS, sectionCard } from '../../../lib/cards/section.ts'
import { SECTIONS }           from '../../../lib/config/sections.ts'
import { SampleDay }          from '../../../lib/daylight/sample-day.ts'

const day     = SampleDay.record()
const root    = new URL('../../../', import.meta.url)
const faces   = await Faces.read(root)
const palette = await readPalette(root)
const card    = (index: number, title = 'The Outside Sensor in Home') => sectionCard(day, faces, palette, {
  count : SECTIONS.length,
  index : index,
  label : 'Install',
  title : title
})

it('holds an hour and a pane of the window for every section', () => {
  expect(HOURS.length).toBeGreaterThanOrEqual(SECTIONS.length)
})

it.for(HOURS.map((hour, index) => ({ hour, index })))(
  'holds every word of the card at $hour minutes past midnight at 4.5:1',
  async ({ index }) => {
    const words = await card(index).audit()

    expect(words.filter(({ contrast }) => contrast < 4.5)).toStrictEqual([])
  }
)

it('names the section’s place, the hour, the true minus sign, and the reading', () => {
  expect(card(0).said).toEqual([
    'luxout.fyi',
    `INSTALL · 1 OF ${SECTIONS.length}`,
    'The Outside',
    'Sensor in Home',
    '06:33 · SUN −3°',
    '54.7',
    'LUX'
  ])
})

it.for([
  { lines: 1, title: 'Limits' },
  { lines: 2, title: 'The Forecast Window' },
  { lines: 3, title: 'A Title Long Enough That Two Lines of Eighty Pixels Cannot Hold All of It' }
])('breaks $title into $lines lines', ({ lines, title }) => {
  expect(card(1, title).said).toHaveLength(5 + lines)
})
