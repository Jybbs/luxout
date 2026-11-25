import { readFile } from 'node:fs/promises'
import { join }     from 'node:path'

import { expect, it } from 'vitest'

import { Faces }                   from '../../../../site/.vitepress/lib/cards/faces.ts'
import { pageTitle, sectionPages } from '../../../../site/.vitepress/lib/config/pages.ts'
import { SECTIONS }                from '../../../../site/.vitepress/lib/config/sections.ts'
import { FONT_FILES, Typeface }    from '../../../../site/.vitepress/lib/type/typeface.ts'
import { site, vitepress }         from '../../common/paths.ts'

const bodoni = new Typeface(await readFile(new URL(FONT_FILES.display, vitepress)))
const faces  = await Faces.read(vitepress)
const titles = SECTIONS.flatMap((section) => [
  pageTitle(join(site, section.slug, 'index.md')),
  ...sectionPages(site, section).map(({ text }) => text)
])

it.for([...new Set(titles.flatMap((title) => title.match(/W[a-z]/g) ?? []))])(
  'kerns the pair %s a page title sets, which Bodoni Moda leaves unkerned',
  (pair) => {
    const axes   = { opsz: 36, wght: 600 }
    const kerned = faces.set({ axes, face: 'display' }, 80, pair).width

    expect(kerned).toBeLessThan(bodoni.set(pair, { axes, size: 80 }).width)
  }
)
