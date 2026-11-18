/** @module-tag draws */
import { decode }     from 'fast-png'
import { expect, it } from 'vitest'

import { Card }        from '../../../lib/cards/card.ts'
import { Faces }       from '../../../lib/cards/faces.ts'
import { readPalette } from '../../../lib/cards/palette.ts'

const root    = new URL('../../../', import.meta.url)
const faces   = await Faces.read(root)
const palette = await readPalette(root)

it('draws a card at 1200 by 630', async () => {
  const { channels, height, width } = decode(await new Card(faces, palette.ground).png())

  expect({ channels, height, width }).toEqual({ channels: 4, height: 630, width: 1200 })
})
