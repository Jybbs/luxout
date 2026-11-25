/** @module-tag draws */
import { readdir, readFile } from 'node:fs/promises'
import { join }              from 'node:path'

import { expect } from 'vitest'

import { renderCards }     from '../../../../site/.vitepress/lib/cards/render.ts'
import { SECTIONS }        from '../../../../site/.vitepress/lib/config/sections.ts'
import { test }            from '../../common/scratch.ts'
import { site, vitepress } from '../../common/paths.ts'

const render = (pages: string[], outDir: string) =>
  renderCards(vitepress, SECTIONS)({ outDir, pages, srcDir: site })

test('writes the site’s card and each page’s card as PNGs in the output directory', async ({ scratch }) => {
  await render(['index.md', 'install/home.md'], scratch)

  const signature = async (path: string) =>
    (await readFile(join(scratch, 'cards', path))).subarray(1, 4).toString()

  expect([await signature('index.png'), await signature('install/home.png')]).toEqual(['PNG', 'PNG'])
})

test('writes no card of its own for a page sharing the site’s card', async ({ scratch }) => {
  await render(['identity.md'], scratch)

  await expect(readdir(join(scratch, 'cards'))).resolves.toEqual(['index.png'])
})

test('fails on a page in no section', async ({ scratch }) => {
  await expect(render(['stray.md'], scratch)).rejects.toThrow('stray.md')
})
