/** @module-tag draws */
import { decode }     from 'fast-png'
import { expect, it } from 'vitest'

import { Card }        from '../../../../site/.vitepress/lib/cards/card.ts'
import { Faces }       from '../../../../site/.vitepress/lib/cards/faces.ts'
import { readPalette } from '../../../../site/.vitepress/lib/cards/palette.ts'
import { vitepress }   from '../../common/paths.ts'

const faces   = await Faces.read(vitepress)
const palette = await readPalette(vitepress)

it('draws a card at 1200 by 630', async () => {
  const { channels, height, width } = decode(await new Card(faces, palette.ground).png())

  expect({ channels, height, width }).toEqual({ channels: 4, height: 630, width: 1200 })
})
