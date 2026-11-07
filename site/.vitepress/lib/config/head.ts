import type { HeadConfig, PageData, SiteData } from 'vitepress'

import * as card from '../cards/card.ts'

/**
 * The parts of the context VitePress hands `transformHead` that the preview
 * reads.
 */
interface Context {
  assets      : string[]
  description : string
  pageData    : Pick<PageData, 'relativePath' | 'title'>
  siteData    : Pick<SiteData, 'lang' | 'title'>
}

/**
 * Describes each kind of card to a reader who cannot see it.
 */
const ALT = {
  section: (title: string) =>
      `The title ${title} beside a six-pane window with one pane lit at an hour of the day, `
    + 'with that hour’s time, sun angle, and reading in lux.',

  site: (host: string) =>
      `The Luxout logo and tagline over a hillside town at dusk, with the address ${host} `
    + 'in a lit window.'
}
const FACE_LINK = { as: 'font', crossorigin: '', rel: 'preload', type: 'font/woff2' }
/**
 * Names the Latin file of each face the head preloads, before Vite adds its
 * hash.
 */
const PRELOADS = ['bodoni-moda-latin-opsz-normal', 'source-serif-4-latin-opsz-normal']
/**
 * Lists the pages that preview as the site rather than as an article, each
 * sharing the front page's card.
 */
const SITE = new Set(['404.md', 'index.md'])

/**
 * Builds the `transformHead` hook, which writes the preview a shared link shows
 * from the page's title and description and from `home`, the site's address,
 * and preloads the faces the page's text opens on.
 */
export function transformHead(home: string): (context: Context) => HeadConfig[] {
  return ({ assets, description, pageData, siteData }) => {
    const { relativePath, title } = pageData
    const { host, href }          = new URL(home)

    const page    = relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')
    const address = new URL(page, home).href
    const whole   = SITE.has(relativePath)
    const image   = new URL(card.cardPath(whole ? 'index.md' : relativePath), home).href
    const alt     = whole ? ALT.site(host) : ALT.section(title)
    const site    = { name: siteData.title, url: href }

    const data = whole
               ? { '@context': 'https://schema.org', '@type': 'WebSite', description, ...site }
               : {
                   '@context'    : 'https://schema.org',
                   '@type'       : 'Article',
                   'description' : description,
                   'headline'    : title,
                   'image'       : image,
                   'isPartOf'    : { '@type': 'WebSite', ...site },
                   'url'         : address
                 }

    return [
      ...assets
        .filter((asset) => PRELOADS.some((face) => asset.includes(`/${face}.`)))
        .map((asset): HeadConfig => ['link', { ...FACE_LINK, href: asset }]),
      ['link', { href: address, rel: 'canonical' }],
      ['meta', { content: description, property: 'og:description' }],
      ['meta', { content: image, property: 'og:image' }],
      ['meta', { content: alt, property: 'og:image:alt' }],
      ['meta', { content: String(card.HEIGHT), property: 'og:image:height' }],
      ['meta', { content: 'image/png', property: 'og:image:type' }],
      ['meta', { content: String(card.WIDTH), property: 'og:image:width' }],
      ['meta', { content: siteData.lang.replace('-', '_'), property: 'og:locale' }],
      ['meta', { content: siteData.title, property: 'og:site_name' }],
      ['meta', { content: title, property: 'og:title' }],
      ['meta', { content: whole ? 'website' : 'article', property: 'og:type' }],
      ['meta', { content: address, property: 'og:url' }],
      ['meta', { content: 'summary_large_image', name: 'twitter:card' }],
      ['meta', { content: image, name: 'twitter:image' }],
      ['meta', { content: alt, name: 'twitter:image:alt' }],
      ['script', { type: 'application/ld+json' }, JSON.stringify(data)]
    ]
  }
}
