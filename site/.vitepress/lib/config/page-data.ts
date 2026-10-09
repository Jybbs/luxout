import type { PageData } from 'vitepress'

interface Facts {
  engines : { homebridge: string, node: string }
  version : string
}

type Page = Pick<PageData, 'frontmatter'>

/**
 * Builds the `transformPageData` hook, which sets the engines and the version
 * on every page's frontmatter under `package`, where a page reads the version
 * as `{{ $frontmatter.package.version }}`.
 */
export function setFacts({ engines, version }: Facts): (page: Page) => Page {
  return ({ frontmatter }) => ({ frontmatter: { ...frontmatter, package: { engines, version } } })
}
