import { readFile } from 'node:fs/promises'
import { join }     from 'node:path'

import type { Plugin, UserConfig }      from 'vite'
import { type PageData, resolveConfig } from 'vitepress'
import { expect, it }                   from 'vitest'

import manifest            from '../../../package.json' with { type: 'json' }
import { transformHead }   from '../lib/config/head.ts'
import { buildNavigation } from '../lib/config/navigation.ts'
import { transformPage }   from '../lib/config/page-data.ts'
import { SECTIONS }        from '../lib/config/sections.ts'
import { luxRange }        from '../lib/daylight/homekit.ts'
import { test }            from './common/scratch.ts'

const front: PageData = {
  description  : '',
  filePath     : 'index.md',
  frontmatter  : {},
  headers      : [],
  relativePath : 'index.md',
  title        : 'Luxout'
}
const site   = join(import.meta.dirname, '..', '..')
const config = await resolveConfig(site, 'build', 'production')

it('caches under the .cache directory at the root of the checkout', () => {
  expect(config.cacheDir).toBe(join(site, '..', '.cache', 'site', 'vitepress'))
})

it('names the site and describes it as package.json does', () => {
  expect(config.site).toMatchObject({ description: manifest.description, title: manifest.displayName })
})

it('feeds the navigation bar and the sidebar from the one registry of sections', () => {
  expect(config.site.themeConfig).toMatchObject(buildNavigation(site, SECTIONS))
})

it('links each scheme’s mark as its favicon and shows each scheme’s title in the navigation bar', () => {
  const icon = (scheme: string) => ['link', {
    href  : `/logo/mark-${scheme}.svg`,
    media : `(prefers-color-scheme: ${scheme})`,
    rel   : 'icon',
    type  : 'image/svg+xml'
  }]

  expect(config.site.head).toEqual(expect.arrayContaining([icon('dark'), icon('light')]))
  expect(config.site.themeConfig).toMatchObject({
    logo      : { alt: 'luxout', dark: '/logo/title-dark.svg', light: '/logo/title-light.svg' },
    siteTitle : false
  })
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

it('compiles the theme’s TSX through Vue’s JSX plugin, leaving its types to Vite’s own transform', () => {
  const plugins = (config.vite?.plugins ?? []).flat() as Plugin[]
  const jsx     = plugins.find(({ name }) => name === 'vite:vue-jsx')
  const hook    = jsx?.config as (this: object, config: UserConfig) => UserConfig

  expect(hook.call({ meta: { rolldownVersion: '' } }, {}).oxc).toEqual({ exclude: /\.jsx?$/ })
})

it('links each page by its address without the .html extension', () => {
  expect(config.cleanUrls).toBe(true)
})

it('caches the hashed files for a year, leaving every other file at the host’s default', async () => {
  expect(await readFile(join(config.publicDir, '_headers'), 'utf8'))
    .toBe(`/${config.assetsDir}/*\n  Cache-Control: public, max-age=31536000, immutable\n`)
})

it('writes the preview of each page through the head hook', async () => {
  const context = { assets: [], description: 'A page.', pageData: front, siteData: config.site }

  expect(await config.transformHead?.(context as never)).toEqual(transformHead(manifest.homepage)(context))
})

test('renders the site’s card into the build’s output through the build hook', async ({ scratch }) => {
  await config.buildEnd?.({ ...config, outDir: scratch, pages: ['index.md'] })

  expect((await readFile(join(scratch, 'cards', 'index.png'))).subarray(1, 4).toString()).toBe('PNG')
}, 60_000)
