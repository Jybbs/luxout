import { readFile } from 'node:fs/promises'
import { join }     from 'node:path'

import { expect, it } from 'vitest'

import { SECTIONS } from '../../../lib/config/sections.ts'

const site = join(import.meta.dirname, '..', '..', '..', '..')

it.each(SECTIONS)('opens the $slug overview on the words the registry holds', async (section) => {
  const { asks, holds, label, slug } = section
  const overview                     = await readFile(join(site, slug, 'index.md'), 'utf8')

  expect(overview.replaceAll('*', '').replaceAll(/\[([^\]]+)\]\([^)]+\)/g, '$1'))
    .toContain(`# ${label}\n\n${asks} ${holds}\n`)
})

it('uses one plain word for each section’s label and its folder', () => {
  expect(SECTIONS.map(({ label }) => label.toLowerCase())).toEqual(SECTIONS.map(({ slug }) => slug))
})
