import type { HeadConfig } from 'vitepress'
import { expect, it }       from 'vitest'

import { transformHead } from '../../../lib/config/head.ts'

const ASSETS = [
  '/assets/bodoni-moda-latin-opsz-normal.B1x9.woff2', '/assets/jetbrains-mono-latin-wght-normal.C2y8.woff2',
  '/assets/source-serif-4-latin-opsz-italic.D3z7.woff2', '/assets/source-serif-4-latin-opsz-normal.E4w6.woff2'
]

const head = transformHead('https://luxout.fyi')

/**
 * Reads the tags other than the preloads as one record, keyed by what each tag
 * names and holding its content, with the JSON-LD parsed.
 */
const preview = (tags: HeadConfig[]) => Object.fromEntries(tags
  .filter(([, { rel }]) => rel !== 'preload')
  .map(([, { content, href, name, property, rel, type }, inner = '{}']) => [
    property ?? name ?? rel ?? type,
    content ?? href ?? JSON.parse(inner)
  ]))

const page = (relativePath: string, title: string) => head({
  assets      : ASSETS,
  description : 'What the plugin reads and how it turns that into lux.',
  pageData    : { relativePath, title },
  siteData    : { lang: 'en-US', title: 'Luxout' }
})

it('writes the preview, the canonical link, and an article for a page past the front page', () => {
  expect(preview(page('estimate/index.md', 'Estimate'))).toMatchInlineSnapshot(`
    {
      "application/ld+json": {
        "@context": "https://schema.org",
        "@type": "Article",
        "description": "What the plugin reads and how it turns that into lux.",
        "headline": "Estimate",
        "image": "https://luxout.fyi/cards/estimate/index.png",
        "isPartOf": {
          "@type": "WebSite",
          "name": "Luxout",
          "url": "https://luxout.fyi/",
        },
        "url": "https://luxout.fyi/estimate/",
      },
      "canonical": "https://luxout.fyi/estimate/",
      "og:description": "What the plugin reads and how it turns that into lux.",
      "og:image": "https://luxout.fyi/cards/estimate/index.png",
      "og:image:alt": "The title Estimate beside a six-pane window with one pane lit at an hour of the day, with that hour’s time, sun angle, and reading in lux.",
      "og:image:height": "630",
      "og:image:type": "image/png",
      "og:image:width": "1200",
      "og:locale": "en_US",
      "og:site_name": "Luxout",
      "og:title": "Estimate",
      "og:type": "article",
      "og:url": "https://luxout.fyi/estimate/",
      "twitter:card": "summary_large_image",
      "twitter:image": "https://luxout.fyi/cards/estimate/index.png",
      "twitter:image:alt": "The title Estimate beside a six-pane window with one pane lit at an hour of the day, with that hour’s time, sun angle, and reading in lux.",
    }
  `)
})

it('describes the front page as the site, with the site card', () => {
  expect(preview(page('index.md', 'Luxout'))).toMatchInlineSnapshot(`
    {
      "application/ld+json": {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "description": "What the plugin reads and how it turns that into lux.",
        "name": "Luxout",
        "url": "https://luxout.fyi/",
      },
      "canonical": "https://luxout.fyi/",
      "og:description": "What the plugin reads and how it turns that into lux.",
      "og:image": "https://luxout.fyi/cards/index.png",
      "og:image:alt": "The Luxout logo and tagline over a hillside town at dusk, with the address luxout.fyi in a lit window.",
      "og:image:height": "630",
      "og:image:type": "image/png",
      "og:image:width": "1200",
      "og:locale": "en_US",
      "og:site_name": "Luxout",
      "og:title": "Luxout",
      "og:type": "website",
      "og:url": "https://luxout.fyi/",
      "twitter:card": "summary_large_image",
      "twitter:image": "https://luxout.fyi/cards/index.png",
      "twitter:image:alt": "The Luxout logo and tagline over a hillside town at dusk, with the address luxout.fyi in a lit window.",
    }
  `)
})

it('describes the not-found page as the site, with the site card', () => {
  expect(preview(page('404.md', '404'))).toMatchInlineSnapshot(`
    {
      "application/ld+json": {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "description": "What the plugin reads and how it turns that into lux.",
        "name": "Luxout",
        "url": "https://luxout.fyi/",
      },
      "canonical": "https://luxout.fyi/404",
      "og:description": "What the plugin reads and how it turns that into lux.",
      "og:image": "https://luxout.fyi/cards/index.png",
      "og:image:alt": "The Luxout logo and tagline over a hillside town at dusk, with the address luxout.fyi in a lit window.",
      "og:image:height": "630",
      "og:image:type": "image/png",
      "og:image:width": "1200",
      "og:locale": "en_US",
      "og:site_name": "Luxout",
      "og:title": "404",
      "og:type": "website",
      "og:url": "https://luxout.fyi/404",
      "twitter:card": "summary_large_image",
      "twitter:image": "https://luxout.fyi/cards/index.png",
      "twitter:image:alt": "The Luxout logo and tagline over a hillside town at dusk, with the address luxout.fyi in a lit window.",
    }
  `)
})

it('addresses a page outside a section index by its path with no extension', () => {
  expect(page('estimate/clouds.md', 'Clouds'))
    .toContainEqual(['link', { href: 'https://luxout.fyi/estimate/clouds', rel: 'canonical' }])
})

it('preloads the Latin file of the display and body faces alone', () => {
  const preloads = page('index.md', 'Luxout')
    .filter(([, { rel }]) => rel === 'preload')
    .map(([, { href }]) => href)

  expect(preloads).toEqual([
    '/assets/bodoni-moda-latin-opsz-normal.B1x9.woff2', '/assets/source-serif-4-latin-opsz-normal.E4w6.woff2'
  ])
})
