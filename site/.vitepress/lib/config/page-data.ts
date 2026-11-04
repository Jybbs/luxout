import { pairs }         from 'd3-array'
import type { PageData } from 'vitepress'

import type { luxRange } from '../daylight/homekit.ts'
import { sectionPages }  from './pages.ts'
import type { Section }  from './sections.ts'

interface Facts {
  engines : { homebridge: string, node: string }
  version : string
}

type Page = Pick<PageData, 'frontmatter' | 'relativePath'>

/**
 * Builds the `transformPageData` hook, which sets the engines, the version, and
 * HomeKit's lux range on every page's frontmatter, and the card into the next
 * section on each section's last page. A page reads the version as
 * `{{ $frontmatter.package.version }}`.
 */
export function setFacts(
  { engines, version } : Facts,
  homekit              : typeof luxRange,
  root                 : string,
  sections             : readonly Section[]
): (page: Page) => Pick<Page, 'frontmatter'> {
  const closing = new Map(pairs(sections).map(([section, { label, slug }]) => [
    `${sectionPages(root, section).at(-1)!.link.slice(1)}.md`,
    { link: `/${slug}/`, text: label }
  ]))

  return ({ frontmatter, relativePath }) => {
    const next = closing.get(relativePath)

    return { frontmatter: { ...frontmatter, ...next && { next }, homekit, package: { engines, version } } }
  }
}
