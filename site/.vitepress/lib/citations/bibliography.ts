import { readFile } from 'node:fs/promises'

import { type CSL, type CSLName, Cite } from '@citation-js/core'
import '@citation-js/plugin-bibtex'

/**
 * Matches a footnote's definition from the line opening on `[^key]:` behind up
 * to three spaces, through each line indented four columns that continues it,
 * together with the line breaks and blank lines above it.
 */
const DEFINITION  = /(?:\n[ \t]*)*^ {0,3}\[\^[^\]\s]+\]:.*(?:(?:\n[ \t]*)*\n(?: {4}| {0,3}\t).*)*/gmu
const MARKER      = /(?<=\[\^)[^\]\s]+(?=\])/gu  // The key alone inside each `[^key]` marker
const PLACEHOLDER = /\{([^}]+)\}/gu
const TEMPLATES: Partial<Record<CSL['type'], string>> = {
  'article-journal' : '{authors}. {year}. "{title}." *{container-title}* {volume} ({issue}): '
                    + '{page}. <{address}>',
  book              : '{authors}. {year}. *{title}*. {collection-title} {collection-number}. <{address}>',
  report            : '{authors}. {year}. "{title}." {publisher}, {number}. <{address}>',
  software          : '{authors}. {year}. "{title}." {publisher}. <{address}>'
}
const listFormat = new Intl.ListFormat('en')

/**
 * Holds each work a bibliography lists, keyed by its BibTeX key, beside the
 * footnote text the template for the work's type gives it and the address its
 * DOI or URL gives.
 */
export class Bibliography {
  readonly #addresses : ReadonlyMap<string, string>
  readonly #notes     : ReadonlyMap<string, string>

  /**
   * Reads BibTeX through citation-js, failing on an entry whose type no
   * template formats and on one leaving out a field its template reads.
   */
  static parse(bibtex: string): Bibliography {
    const works = new Cite(bibtex).data
    const keyed = (read: (work: CSL) => string) => new Map(works.map((work) => [String(work.id), read(work)]))

    return new Bibliography(keyed(footnote), keyed((work) => addressOf(work)!))
  }

  /**
   * Reads the site's `references.bib`, which sits beside `root`, the site's
   * `.vitepress` directory.
   */
  static async read(root: URL): Promise<Bibliography> {
    return Bibliography.parse(await readFile(new URL('../references.bib', root), 'utf8'))
  }

  constructor(notes: ReadonlyMap<string, string>, addresses: ReadonlyMap<string, string> = new Map()) {
    this.#addresses = addresses
    this.#notes     = notes
  }

  /**
   * Reads the address of the work `key` names, its DOI's or else its URL,
   * failing where the bibliography holds no entry for it.
   */
  address(key: string): string {
    return this.#addresses.get(key) ?? fail(`The bibliography holds no entry for ${key}`)
  }

  /**
   * Places the footnote text of each work `page` cites at the page's end, in
   * the order the page first cites each and a blank line apart. That text
   * replaces every footnote definition the page held.
   */
  cite(page: string): string {
    const body = page.replaceAll(DEFINITION, '').trimEnd()
    const keys = new Set(body.matchAll(MARKER).map(([key]) => key))

    return `${[body, ...keys.values().map((key) => this.#note(key))].join('\n\n')}\n`
  }

  #note(key: string): string {
    return `[^${key}]: ${this.#notes.get(key) ?? fail(`The bibliography holds no entry for ${key}`)}`
  }
}

/**
 * Reads the address `work`'s DOI gives, or else its URL.
 */
function addressOf(work: CSL): string | undefined {
  return work.DOI ? `https://doi.org/${work.DOI}` : work.URL
}

/**
 * Joins up to three family names, each with the particle BibTeX writes before
 * it, and shortens four or more, or a list ending on BibTeX's `others`, to the
 * first beside `et al`, whose period the template supplies.
 */
function authors(names: readonly CSLName[]): string {
  const families = names.map((name) => [name['non-dropping-particle'], name.family].filter(Boolean).join(' '))

  return families.length > 3 || families.at(-1) === 'others'
       ? `${families[0]} et al`
       : listFormat.format(families)
}

function fail(message: string): never {
  throw new Error(message)
}

/**
 * Fills the template for `work`'s type with the work's own fields, beside its
 * authors, its year, and its address.
 */
function footnote(work: CSL): string {
  const template = TEMPLATES[work.type]
                ?? fail(`${work.id} is an entry of type ${work.type}, which no footnote template formats`)
  const fields: Record<string, unknown> = {
    ...work,
    address : addressOf(work),
    authors : work.author?.every(({ family }) => family) && authors(work.author),
    year    : work.issued?.['date-parts']?.[0][0]
  }

  return template.replaceAll(PLACEHOLDER, (_, field: string) => {
    const value = fields[field]

    return typeof value === 'string' || typeof value === 'number'
         ? String(value)
         : fail(`${work.id} leaves out the ${field} its footnote template reads`)
  })
}
