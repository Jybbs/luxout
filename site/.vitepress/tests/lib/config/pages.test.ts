import { writeFile } from 'node:fs/promises'
import { join }      from 'node:path'

import { expect } from 'vitest'

import { pageOpening, sectionPages } from '../../../lib/config/pages.ts'
import { plant, test as scratch }   from '../../common/scratch.ts'

const PAGES = {
  'alpha.md' : '# *Alpha* Page\n',
  'index.md' : '# Guide\n\n- [Zeta](./zeta.md)\n- [Alpha](./alpha.md)\n',
  'zeta.md'  : '# Zeta Page\n'
}
const SECTION = { asks: '', holds: '', label: 'Guide', slug: 'guide' }
const test    = scratch.extend('root', async ({ scratch: root }) => {
  await plant(join(root, 'guide'), PAGES)

  return root
})

test('labels each page by its first heading, with the name styling dropped', ({ root }) => {
  expect(sectionPages(root, SECTION).map(({ text }) => text)).toContain('Alpha Page')
})

test('alphabetizes a reference section', ({ root }) => {
  expect(sectionPages(root, SECTION).map(({ link }) => link)).toEqual(['/guide/alpha', '/guide/zeta'])
})

test('keeps the overview’s order for a curated section', ({ root }) => {
  const pages = sectionPages(root, { ...SECTION, curated: true })

  expect(pages.map(({ link }) => link)).toEqual(['/guide/zeta', '/guide/alpha'])
})

test('fails on a page with no first-level heading', async ({ root }) => {
  await writeFile(join(root, 'guide', 'alpha.md'), 'No heading\n')

  expect(() => sectionPages(root, SECTION)).toThrow('alpha.md opens on no first-level heading')
})

test('fails on a page the overview leaves unlinked', async ({ root }) => {
  await writeFile(join(root, 'guide', 'stray.md'), '# Stray\n')

  expect(() => sectionPages(root, SECTION)).toThrow('The guide overview links no page named stray')
})

test('reads the paragraph beneath a page’s first heading, with the name styling dropped', async ({ root }) => {
  const page = join(root, 'guide', 'alpha.md')

  await writeFile(page, '# Alpha\n\nAn *Alpha* line.\n\nMore.\n')

  expect(pageOpening(page)).toBe('An Alpha line.')
})

test('fails on a page with no paragraph beneath its first heading', ({ root }) => {
  expect(() => pageOpening(join(root, 'guide', 'zeta.md')))
    .toThrow('zeta.md opens on no paragraph beneath its first heading')
})
