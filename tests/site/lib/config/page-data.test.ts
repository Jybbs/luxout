import { access } from 'node:fs/promises'
import { join }   from 'node:path'

import { expect, it } from 'vitest'

import manifest          from '../../../../package.json' with { type: 'json' }
import { transformPage } from '../../../../site/.vitepress/lib/config/page-data.ts'
import { SECTIONS }      from '../../../../site/.vitepress/lib/config/sections.ts'
import { luxRange }      from '../../../../site/.vitepress/lib/daylight/homekit.ts'

const context = { siteConfig: { srcDir: join(import.meta.dirname, 'fixtures') } }
const front   = {
  filePath     : 'index.md',
  frontmatter  : {},
  relativePath : 'index.md',
  title        : 'Daybreak'
}
const setup   = {
  filePath     : 'setup.md',
  frontmatter  : { title: 'Setup' },
  relativePath : 'setup.md',
  title        : 'Setup'
}
const site      = join(import.meta.dirname, '..', '..', '..', '..', 'site')
const transform = transformPage(manifest, luxRange, site, SECTIONS)

it('sets the engines, the version, and the lux range on a page, beside its own keys', () => {
  expect(transform(setup, context)).toEqual({
    frontmatter: {
      footer  : false,
      homekit : luxRange,
      package : { engines: manifest.engines, version: manifest.version },
      title   : 'Setup'
    }
  })
})

it('carries a bumped version to every page', () => {
  const bumped = transformPage({ engines: manifest.engines, version: '0.1.0' }, luxRange, site, SECTIONS)
  const pages  = [setup, { ...setup, relativePath: 'b.md' }].map((page) => bumped(page, context))

  expect(pages.map(({ frontmatter }) => frontmatter.package.version)).toEqual(['0.1.0', '0.1.0'])
})

it('replaces a package key a page declares with the facts package.json declares', () => {
  const declared        = { ...setup, frontmatter: { package: 'homebridge-luxout' } }
  const { frontmatter } = transform(declared, context)

  expect(frontmatter.package).toEqual({ engines: manifest.engines, version: manifest.version })
})

it.each([
  { link: '/sensors/', page: 'install/home.md', text: 'Sensors' },
  { link: '/settings/', page: 'sensors/thresholds.md', text: 'Settings' },
  { link: '/estimate/', page: 'settings/thresholds.md', text: 'Estimate' },
  { link: '/privacy/', page: 'estimate/failed-fetches.md', text: 'Privacy' },
  { link: '/troubleshooting/', page: 'privacy/sends.md', text: 'Troubleshooting' }
])('closes $page on a card into $text', ({ link, page, text }) => {
  const { frontmatter } = transform({ ...setup, relativePath: page }, context)

  expect(frontmatter.next).toEqual({ link, text })
})

it.each([
  { name: 'a page inside a section', page: 'install/place.md' },
  { name: 'the last section, which has none to lead to', page: 'troubleshooting/reporting.md' }
])('sets no card on $name', ({ page }) => {
  const { frontmatter } = transform({ ...setup, relativePath: page }, context)

  expect(frontmatter.next).toBeUndefined()
})

it('gives the front page the home layout and a hero restating its title and opening paragraph', () => {
  const { frontmatter } = transform(front, context)

  expect(frontmatter).toMatchObject({
    hero   : { name: 'Daybreak', tagline: 'A tagline set in italics.' },
    layout : 'home'
  })
})

it('fails on a front page that opens on no paragraph', () => {
  const bare = { ...setup, filePath: 'bare.md', relativePath: 'index.md' }

  expect(() => transform(bare, context)).toThrow('bare.md opens on no paragraph beneath its first heading')
})

it('leads the hero into Install and then Estimate', () => {
  const { frontmatter } = transform(front, context)

  expect(frontmatter.hero.actions).toEqual([
    { link: '/install/', text: 'Set It Up', theme: 'brand' },
    { link: '/estimate/', text: 'How the Estimate Works', theme: 'alt' }
  ])
})

it('opens a page of the site on each hero action', async () => {
  const { frontmatter } = transform(front, context)
  const pages           = frontmatter.hero.actions.map(({ link }: { link: string }) =>
    join(site, link, 'index.md')
  )

  await expect(Promise.all(pages.map((page: string) => access(page)))).resolves.toBeDefined()
})

it('leaves the layout and the hero of every other page to the page', () => {
  const { frontmatter } = transform(setup, context)

  expect(frontmatter).not.toHaveProperty('hero')
  expect(frontmatter).not.toHaveProperty('layout')
})

it('sets the footer on the front page alone', () => {
  const pages = [front, setup, { ...setup, relativePath: 'identity.md' }]
    .map((page) => transform(page, context))

  expect(pages.map(({ frontmatter }) => frontmatter.footer)).toEqual([undefined, false, false])
})
