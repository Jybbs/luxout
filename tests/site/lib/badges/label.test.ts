import { it }             from 'vitest'
import { renderToString } from 'vue/server-renderer'

import { BADGES, badgeLabel } from '../../../../site/.vitepress/lib/badges/label.ts'
import { Faces }              from '../../../../site/.vitepress/lib/cards/faces.ts'
import { readPalette }        from '../../../../site/.vitepress/lib/cards/palette.ts'

const root             = new URL('../../../../site/.vitepress/', import.meta.url)
const [faces, palette] = await Promise.all([Faces.read(root), readPalette(root)])

it.for(BADGES)('holds the %s label the README sets beside its value', async (badge, { expect }) => {
  await expect(`${await renderToString(badgeLabel(faces, palette, badge))}\n`)
    .toMatchFileSnapshot(`../../../../public/badges/${badge}.svg`)
})
