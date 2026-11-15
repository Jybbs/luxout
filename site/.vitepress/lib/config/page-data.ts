import { join } from 'node:path'

import { pairs }                     from 'd3-array'
import type { PageData, SiteConfig } from 'vitepress'

import type { luxRange }             from '../daylight/homekit.ts'
import { pageOpening, sectionPages } from './pages.ts'
import type { Section }              from './sections.ts'

interface Facts {
  engines : { homebridge: string, node: string }
  version : string
}

type Hook = (page: Page, context: { siteConfig: Site }) => Pick<Page, 'frontmatter'>
type Page = Pick<PageData, 'filePath' | 'frontmatter' | 'relativePath' | 'title'>
type Site = Pick<SiteConfig, 'srcDir'>

const HOME = 'index.md'

/**
 * Builds the `transformPageData` hook, which sets the engines, the version, and
 * HomeKit's lux range on every page's frontmatter, the card into the next
 * section on each section's last page, the footer on the front page alone, and
 * the home layout on the front page with a hero restating its title and its
 * opening paragraph, beside an action into each section that declares one. A
 * page reads the version as `{{ $frontmatter.package.version }}`.
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

  return (page, { siteConfig }) => {
    const next = closing.get(page.relativePath)

    return {
      frontmatter: {
        ...page.frontmatter,
        ...next && { next },
        ...page.relativePath === HOME ? {
          layout : 'home',
          hero   : {
            actions : actions,
            name    : page.title,
            tagline : pageOpening(join(siteConfig.srcDir, page.filePath))
          }
        } : { footer: false },
        homekit : homekit,
        package : { engines, version }
      }
    }
  }
}
