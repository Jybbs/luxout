/** @module-tag draws */
import { readFile } from 'node:fs/promises'
import { join }     from 'node:path'

import { expect, it } from 'vitest'

import { Faces }       from '../../../lib/cards/faces.ts'
import { hillCard }    from '../../../lib/cards/hill.ts'
import { readPalette } from '../../../lib/cards/palette.ts'
import { SampleDay }   from '../../../lib/daylight/sample-day.ts'
import { Logo }        from '../../../lib/logo/logo.ts'

const root = new URL('../../../', import.meta.url)
const card = hillCard(
  SampleDay.record(),
  await Faces.read(root),
  await Logo.read(root),
  await readPalette(root)
)

it('sets the site’s card in three lines of words at 4.5:1', async () => {
  const words = await card.audit()

  expect(card.said).toEqual(['An outdoor light sensor', 'for Apple Home.', 'luxout.fyi'])
  expect(words.filter(({ contrast }) => contrast < 4.5)).toStrictEqual([])
})

it('sets the tagline the front page opens on', async () => {
  const [first, second] = card.said
  const site            = join(import.meta.dirname, '..', '..', '..', '..')

  expect(await readFile(join(site, 'index.md'), 'utf8')).toContain(`*${first} ${second}*`)
})

it('measures each word of the site’s card against the pixels under its ink', async () => {
  expect((await card.audit()).map(({ contrast, text }) => [text, contrast.toFixed(2)])).toEqual([
    ['An outdoor light sensor', '14.13'],
    ['for Apple Home.', '14.47'],
    ['luxout.fyi', '10.58']
  ])
})
