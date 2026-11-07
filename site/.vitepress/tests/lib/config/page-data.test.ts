import { join } from 'node:path'

import { expect, it } from 'vitest'

import manifest          from '../../../../../package.json' with { type: 'json' }
import { transformPage } from '../../../lib/config/page-data.ts'
import { SECTIONS }      from '../../../lib/config/sections.ts'
import { luxRange }      from '../../../lib/daylight/homekit.ts'

const site      = join(import.meta.dirname, '..', '..', '..', '..')
const context   = { siteConfig: { srcDir: join(import.meta.dirname, 'fixtures') } }
const setup     = {
  filePath     : 'setup.md',
  frontmatter  : { title: 'Setup' },
  relativePath : 'setup.md',
  title        : 'Setup'
}
const transform = transformPage(manifest, luxRange, site, SECTIONS)

it('sets the engines, the version, and the lux range on a page, beside its own keys', async () => {
  expect(await transform(setup, context)).toEqual({
    frontmatter: {
      homekit : luxRange,
      package : { engines: manifest.engines, version: manifest.version },
      title   : 'Setup'
    }
  })
})

it('carries a bumped version to every page', async () => {
  const bumped = transformPage({ engines: manifest.engines, version: '0.1.0' }, luxRange, site, SECTIONS)
  const pages  = await Promise.all([setup, { ...setup, relativePath: 'b.md' }].map((page) =>
    bumped(page, context)
  ))

  expect(pages.map(({ frontmatter }) => frontmatter.package.version)).toEqual(['0.1.0', '0.1.0'])
})

it('replaces a package key a page declares with the facts package.json declares', async () => {
  const declared        = { ...setup, frontmatter: { package: 'homebridge-luxout' } }
  const { frontmatter } = await transform(declared, context)

  expect(frontmatter.package).toEqual({ engines: manifest.engines, version: manifest.version })
})

it.each([
  { link: '/sensors/', page: 'install/home.md', text: 'Sensors' },
  { link: '/settings/', page: 'sensors/thresholds.md', text: 'Settings' },
  { link: '/estimate/', page: 'settings/thresholds.md', text: 'Estimate' }
])('closes $page on a card into $text', async ({ link, page, text }) => {
  const { frontmatter } = await transform({ ...setup, relativePath: page }, context)

  expect(frontmatter.next).toEqual({ link, text })
})

it.each([
  { name: 'a page inside a section', page: 'install/place.md' },
  { name: 'the last section, which has none to lead to', page: 'estimate/failed-fetches.md' }
])('sets no card on $name', async ({ page }) => {
  const { frontmatter } = await transform({ ...setup, relativePath: page }, context)

  expect(frontmatter.next).toBeUndefined()
})

it('gives the front page the home layout and a hero restating its title and opening paragraph', async () => {
  const front = {
    filePath     : 'index.md',
    frontmatter  : {},
    relativePath : 'index.md',
    title        : 'Daybreak'
  }

  const { frontmatter } = await transform(front, context)

  expect(frontmatter).toMatchObject({
    hero   : { name: 'Daybreak', tagline: 'A tagline set in italics.' },
    layout : 'home'
  })
})

it('sets an empty tagline on a front page that opens on no paragraph', async () => {
  const bare            = { ...setup, filePath: 'bare.md', relativePath: 'index.md' }
  const { frontmatter } = await transform(bare, context)

  expect(frontmatter.hero).toEqual({ name: 'Setup', tagline: '' })
})

it('leaves the layout and the hero of every other page to the page', async () => {
  const { frontmatter } = await transform(setup, context)

  expect(frontmatter).not.toHaveProperty('hero')
  expect(frontmatter).not.toHaveProperty('layout')
})
