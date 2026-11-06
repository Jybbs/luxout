import { readFile } from 'node:fs/promises'
import { join }     from 'node:path'

import { resolveConfig } from 'vitepress'
import { expect, it }    from 'vitest'

import { Bibliography } from '../lib/citations/bibliography.ts'

const { pages, srcDir } = await resolveConfig(join(import.meta.dirname, '..', '..'), 'build', 'production')
const bibliography      = Bibliography.parse(await readFile(join(srcDir, 'references.bib'), 'utf8'))

it.each(pages)('%s carries the footnote text site:cite writes from references.bib', async (page) => {
  const path = join(srcDir, page)

  await expect(bibliography.cite(await readFile(path, 'utf8'))).toMatchFileSnapshot(path)
})

it('cites every work on the bibliography page', async () => {
  const page = await readFile(join(srcDir, 'estimate', 'bibliography.md'), 'utf8')
  const keys = (await readFile(join(srcDir, 'references.bib'), 'utf8')).matchAll(/^@\w+\{(\w+),$/gm)

  expect(keys.filter(([, key]) => !page.includes(`[^${key!}]`)).toArray()).toEqual([])
})
