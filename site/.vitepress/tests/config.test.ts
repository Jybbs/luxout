import { readFile } from 'node:fs/promises'
import { join }     from 'node:path'

import { type PageData, resolveConfig } from 'vitepress'
import { expect, it }                   from 'vitest'

import manifest            from '../../../package.json' with { type: 'json' }
import { favicons, title } from '../lib/config/logo.ts'
import { buildNavigation } from '../lib/config/navigation.ts'
import { transformPage }   from '../lib/config/page-data.ts'
import { SECTIONS }        from '../lib/config/sections.ts'
import { luxRange }        from '../lib/daylight/homekit.ts'

const site   = join(import.meta.dirname, '..', '..')
const config = await resolveConfig(site, 'build', 'production')

const front: PageData = {
  description  : '',
  filePath     : 'index.md',
  frontmatter  : {},
  headers      : [],
  relativePath : 'index.md',
  title        : 'Luxout'
}

it('caches under the .cache directory at the root of the checkout', () => {
  expect(config.cacheDir).toBe(join(site, '..', '.cache', 'site', 'vitepress'))
})

it('names the site and describes it as package.json does', () => {
  expect(config.site).toMatchObject({ description: manifest.description, title: manifest.displayName })
})

it('feeds the navigation bar and the sidebar from the one registry of sections', () => {
  expect(config.site.themeConfig).toMatchObject(buildNavigation(site, SECTIONS))
})

it('shows the logo in place of the title text in the navigation bar', () => {
  expect(config.site.themeConfig).toMatchObject({ logo: title, siteTitle: false })
})

it('links the mark in each scheme as the favicon', () => {
  expect(config.site.head).toEqual(expect.arrayContaining(favicons))
})

it('sets the facts package.json declares on every page', async () => {
  const context = { siteConfig: config }

  expect(await config.transformPageData?.(front, context))
    .toEqual(await transformPage(manifest, luxRange, site, SECTIONS)(front, context))
})

it('sets the front page hero to the title and the tagline the page opens on', async () => {
  const data = await config.transformPageData?.(front, { siteConfig: config })

  expect(data?.frontmatter.hero)
    .toEqual({ name: 'Luxout', tagline: 'An outdoor light sensor for Apple Home.' })
})

it('renders the value transformPageData sets wherever a page interpolates a fact', () => {
  expect(config.markdown?.eagerFrontmatterInterpolation).toBe(false)
})

it('serves the CSS the build ships, through Lightning CSS', () => {
  expect(config.vite?.css?.transformer).toBe('lightningcss')
})

it('links each page by its address without the .html extension', () => {
  expect(config.cleanUrls).toBe(true)
})

it('caches the hashed files for a year, leaving every other file at the host’s default', async () => {
  expect(await readFile(join(config.publicDir, '_headers'), 'utf8'))
    .toBe(`/${config.assetsDir}/*\n  Cache-Control: public, max-age=31536000, immutable\n`)
})
