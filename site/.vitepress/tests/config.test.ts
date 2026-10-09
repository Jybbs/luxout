import { join } from 'node:path'

import { type PageData, resolveConfig } from 'vitepress'
import { expect, it }                   from 'vitest'

import manifest            from '../../../package.json' with { type: 'json' }
import { buildNavigation } from '../lib/config/navigation.ts'
import { setFacts }        from '../lib/config/page-data.ts'
import { SECTIONS }        from '../lib/config/sections.ts'

const site   = join(import.meta.dirname, '..', '..')
const config = await resolveConfig(site, 'build', 'production')

it('caches under the .cache directory at the root of the checkout', () => {
  expect(config.cacheDir).toBe(join(site, '..', '.cache', 'site', 'vitepress'))
})

it('names the site and describes it as package.json does', () => {
  expect(config.site).toMatchObject({ description: manifest.description, title: manifest.displayName })
})

it('feeds the navigation bar and the sidebar from the one registry of sections', () => {
  expect(config.site.themeConfig).toEqual(buildNavigation(SECTIONS))
})

it('sets the facts package.json declares on every page', async () => {
  const page: PageData = {
    description  : '',
    filePath     : 'index.md',
    frontmatter  : {},
    headers      : [],
    relativePath : 'index.md',
    title        : 'Luxout'
  }

  expect(await config.transformPageData?.(page, { siteConfig: config })).toEqual(setFacts(manifest)(page))
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
