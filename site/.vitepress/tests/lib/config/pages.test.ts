import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir }                        from 'node:os'
import { join }                          from 'node:path'

import { test as base, expect } from 'vitest'

import { sectionPages } from '../../../lib/config/pages.ts'

const PAGES = {
  'alpha.md' : '# *Alpha* Page\n',
  'index.md' : '# Guide\n\n- [Zeta](./zeta.md)\n- [Alpha](./alpha.md)\n',
  'zeta.md'  : '# Zeta Page\n'
}
const SECTION = { asks: '', holds: '', label: 'Guide', slug: 'guide' }

const test = base.extend('root', async ({ onTestFinished }) => {
  const root = await mkdtemp(join(tmpdir(), 'luxout-'))

  onTestFinished(() => rm(root, { force: true, recursive: true }))
  await mkdir(join(root, 'guide'))
  await Promise.all(Object.entries(PAGES).map(([name, text]) => writeFile(join(root, 'guide', name), text)))

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
