import { join } from 'node:path'

import { expect, it } from 'vitest'

import manifest     from '../../../../../package.json' with { type: 'json' }
import { setFacts } from '../../../lib/config/page-data.ts'
import { SECTIONS } from '../../../lib/config/sections.ts'
import { luxRange } from '../../../lib/daylight/homekit.ts'

const site      = join(import.meta.dirname, '..', '..', '..', '..')
const transform = setFacts(manifest, luxRange, site, SECTIONS)

it('sets the engines, the version, and the lux range on a page, beside its own keys', () => {
  expect(transform({ frontmatter: { title: 'Setup' }, relativePath: 'index.md' })).toEqual({
    frontmatter: {
      homekit : luxRange,
      package : { engines: manifest.engines, version: manifest.version },
      title   : 'Setup'
    }
  })
})

it('carries a bumped version to every page', () => {
  const bumped = setFacts({ engines: manifest.engines, version: '0.1.0' }, luxRange, site, SECTIONS)
  const pages  = ['a.md', 'b.md'].map((relativePath) => bumped({ frontmatter: {}, relativePath }))

  expect(pages.map(({ frontmatter }) => frontmatter.package.version)).toEqual(['0.1.0', '0.1.0'])
})

it('replaces a package key a page declares with the facts package.json declares', () => {
  const page            = { frontmatter: { package: 'homebridge-luxout' }, relativePath: 'index.md' }
  const { frontmatter } = transform(page)

  expect(frontmatter.package).toEqual({ engines: manifest.engines, version: manifest.version })
})

it.each([
  { link: '/sensors/', page: 'install/home.md', text: 'Sensors' },
  { link: '/settings/', page: 'sensors/thresholds.md', text: 'Settings' },
  { link: '/estimate/', page: 'settings/thresholds.md', text: 'Estimate' }
])('closes $page on a card into $text', ({ link, page, text }) => {
  expect(transform({ frontmatter: {}, relativePath: page }).frontmatter.next).toEqual({ link, text })
})

it.each([
  { name: 'a page inside a section', page: 'install/place.md' },
  { name: 'the last section, which has none to lead to', page: 'estimate/failed-fetches.md' }
])('sets no card on $name', ({ page }) => {
  expect(transform({ frontmatter: {}, relativePath: page }).frontmatter.next).toBeUndefined()
})
