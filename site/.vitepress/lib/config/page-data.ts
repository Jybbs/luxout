import { readFile } from 'node:fs/promises'
import { join }     from 'node:path'

import { pairs }                                                  from 'd3-array'
import { type PageData, type SiteConfig, createMarkdownRenderer } from 'vitepress'

import type { luxRange } from '../daylight/homekit.ts'
import { sectionPages }  from './pages.ts'
import type { Section }  from './sections.ts'

interface Facts {
  engines : { homebridge: string, node: string }
  version : string
}

type Hook = (page: Page, context: { siteConfig: Site }) => Promise<Pick<Page, 'frontmatter'>>
type Page = Pick<PageData, 'filePath' | 'frontmatter' | 'relativePath' | 'title'>
type Site = Pick<SiteConfig, 'srcDir'>

const HOME = 'index.md'

/**
 * Reads the front page's hero from the page itself, as its title and the text
 * of the paragraph that opens it, through the one Markdown renderer VitePress
 * holds, which it has already built from the site's `markdown` options.
 */
async function heroOf({ filePath, title }: Page, srcDir: string): Promise<{ name: string, tagline: string }> {
  const md      = await createMarkdownRenderer(srcDir)
  const tokens  = md.parse(await readFile(join(srcDir, filePath), 'utf8'), {})
  const opening = tokens.findIndex(({ type }) => type === 'paragraph_open')
  const words   = tokens[opening + 1]?.children?.filter(({ type }) => type === 'text') ?? []

  return { name: title, tagline: words.map(({ content }) => content).join('') }
}

/**
 * Builds the `transformPageData` hook, which sets the engines, the version, and
 * HomeKit's lux range on every page's frontmatter, the card into the next
 * section on each section's last page, and the home layout on the front page
 * with a hero restating its title and its opening paragraph, beside an action
 * into each section that declares one. A page reads the version as
 * `{{ $frontmatter.package.version }}`.
 */
export function transformPage(
  { engines, version } : Facts,
  homekit              : typeof luxRange,
  root                 : string,
  sections             : readonly Section[]
): Hook {
  const closing = new Map(pairs(sections).map(([section, { label, slug }]) => [
    `${sectionPages(root, section).at(-1)!.link.slice(1)}.md`,
    { link: `/${slug}/`, text: label }
  ]))
  const actions = sections.flatMap(({ action, slug }) => action ? [{ link: `/${slug}/`, ...action }] : [])

  return async (page, { siteConfig }) => {
    const next = closing.get(page.relativePath)

    return {
      frontmatter: {
        ...page.frontmatter,
        ...next && { next },
        ...page.relativePath === HOME && {
          hero   : { ...await heroOf(page, siteConfig.srcDir), actions },
          layout : 'home'
        },
        homekit : homekit,
        package : { engines, version }
      }
    }
  }
}
