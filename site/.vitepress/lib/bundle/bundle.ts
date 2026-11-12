import { globSync, readFileSync } from 'node:fs'
import { join }                   from 'node:path'

import { Window } from 'happy-dom'

import { Chunk } from './chunk.ts'
import { Sheet } from './sheet.ts'

const DIST = join('.vitepress', 'dist')

/**
 * Holds the site `site:press` builds under `.vitepress/dist` beside the
 * stylesheets of the theme it builds from.
 */
export class Bundle {
  readonly #chunks  : Chunk[]
  readonly #pages   : string[]
  readonly #sheets  : Sheet[]
  readonly #sources : Sheet[]

  /**
   * Reads the build and the theme's stylesheets from the site package at
   * `root`.
   */
  static read(root: string): Bundle {
    const files = (pattern: string) => globSync(pattern, { cwd: root })
      .toSorted()
      .map((file) => [file, readFileSync(join(root, file), 'utf8')] as const)

    return new Bundle(
      files(join(DIST, 'assets', '**', '*.js')).map(([file, code]) => new Chunk(code, file)),
      files(join(DIST, '**', '*.html')).map(([, html]) => html),
      files(join(DIST, 'assets', '**', '*.css')).map((entry) => new Sheet(...entry)),
      files(join('.vitepress', 'theme', '**', '*.css')).map((entry) => new Sheet(...entry))
    )
  }

  constructor(chunks: Chunk[], pages: string[], sheets: Sheet[], sources: Sheet[]) {
    this.#chunks  = chunks
    this.#pages   = pages
    this.#sheets  = sheets
    this.#sources = sources
  }

  /**
   * Lists each `color-mix()` call of the theme that the minifier replaced with
   * the fixed color it computes, since no built stylesheet holds it.
   */
  get #folded(): string[] {
    const built = new Set(this.#sheets.flatMap(({ mixes }) => mixes))

    return this.#sources.flatMap(({ file, mixes }) => mixes
      .filter((mix) => !built.has(mix))
      .map((mix) => `${file}: the minifier folds ${mix} into a fixed color`))
  }

  /**
   * Writes each defect the build carries to `write`, one line apiece.
   *
   * Returns:
   *   The exit status, 1 where the build carries a defect and 0 otherwise.
   */
  async report(write: (line: string) => void = console.log): Promise<number> {
    const defects = [
      ...this.#pages.length === 0 ? [`${DIST}: holds no page to inspect`] : [],
      ...this.#chunks.flatMap(({ defects }) => defects),
      ...await this.#unmatched(),
      ...this.#folded
    ]

    defects.forEach((defect) => write(defect))

    return Math.sign(defects.length)
  }

  /**
   * Lists each built rule keyed on an image address that matches no element
   * on any page, which is what a rule naming a source image does once Vite
   * rewrites the image's address to a hashed one under `/assets/`.
   */
  async #unmatched(): Promise<string[]> {
    const window    = new Window()
    const documents = this.#pages.map((html) => new window.DOMParser().parseFromString(html, 'text/html'))
    const unmatched = this.#sheets.flatMap(({ file, images }) => images
      .filter((selector) => !documents.some((document) => document.querySelector(selector)))
      .map((selector) => `${file}: ${selector} matches no element on any page`))

    await window.happyDOM.close()

    return unmatched
  }
}
