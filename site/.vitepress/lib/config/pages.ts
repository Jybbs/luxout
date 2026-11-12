import { readdirSync, readFileSync } from 'node:fs'
import { basename, join }            from 'node:path'

import { sort } from 'd3-array'

import type { Section } from './sections.ts'

/**
 * One page of a section, labeled by its first heading.
 */
interface SectionPage {
  link : string
  text : string
}

const HEADING = /(?<=^# ).+$/m
const LINK    = /(?<=\]\(\.\/)[\w-]+(?=\.md\))/g

/**
 * Reads the first heading of the page at `path` as plain text.
 */
export function pageTitle(path: string): string {
  const heading = HEADING.exec(readFileSync(path, 'utf8'))

  if (!heading) throw new Error(`${path} opens on no first-level heading`)

  return heading[0].replaceAll('*', '')
}

/**
 * Lists the pages of a section beneath its overview, in the order the overview
 * links them where the section is curated and alphabetically otherwise, failing
 * on a page the overview leaves unlinked.
 */
export function sectionPages(root: string, { curated, slug }: Section): SectionPage[] {
  const folder = join(root, slug)
  const index  = readFileSync(join(folder, 'index.md'), 'utf8')
  const linked = new Set(index.matchAll(LINK).map(([name]) => name))
  const files  = readdirSync(folder).filter((name) => name.endsWith('.md') && name !== 'index.md')
  const stray  = new Set(files.map((name) => basename(name, '.md'))).difference(linked)

  if (stray.size) throw new Error(`The ${slug} overview links no page named ${[...stray].join(', ')}`)

  const pages = [...linked].map((name) => ({
    link : `/${slug}/${name}`,
    text : pageTitle(join(folder, `${name}.md`))
  }))

  return curated ? pages : sort(pages, ({ text }) => text)
}
