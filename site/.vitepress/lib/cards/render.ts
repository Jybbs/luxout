import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join }    from 'node:path'

import type { SiteConfig } from 'vitepress'

import { pageTitle }    from '../config/pages.ts'
import type { Section } from '../config/sections.ts'
import { SampleDay }    from '../daylight/sample-day.ts'
import { Logo }         from '../logo/logo.ts'
import { cardPath }     from './card.ts'
import { Faces }        from './faces.ts'
import { hillCard }     from './hill.ts'
import { readPalette }  from './palette.ts'
import { sectionCard }  from './section.ts'

/**
 * Builds the `buildEnd` hook, which writes the site's card to `cards/index.png`
 * and each page of a section to `cards/<page>.png` beneath the build's output,
 * failing on a page in no section.
 *
 * Args:
 *   root     : The site's `.vitepress` directory.
 *   sections : The sections in reading order.
 */
export function renderCards(
  root     : URL,
  sections : readonly Section[]
): (config: Pick<SiteConfig, 'outDir' | 'pages' | 'srcDir'>) => Promise<void> {
  return async ({ outDir, pages, srcDir }) => {
    const day                    = SampleDay.record()
    const [faces, logo, palette] = await Promise.all([Faces.read(root), Logo.read(root), readPalette(root)])
    const write                  = async (page: string, png: Uint8Array) => {
      const path = join(outDir, cardPath(page))

      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, png)
    }

    await write('index.md', await hillCard(day, faces, logo, palette).png())

    for (const page of pages.filter((each) => each !== 'index.md')) {
      const index = sections.findIndex(({ slug }) => page.startsWith(`${slug}/`))

      if (index < 0) throw new Error(`${page} belongs to no section, so it has no card to render`)

      const sheet = {
        count : sections.length,
        index : index,
        label : sections[index]!.label,
        title : pageTitle(join(srcDir, page))
      }

      await write(page, await sectionCard(day, faces, palette, sheet).png())
    }
  }
}
