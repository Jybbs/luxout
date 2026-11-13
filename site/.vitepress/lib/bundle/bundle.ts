import { globSync, readFileSync } from 'node:fs'
import { join }                   from 'node:path'

import { Window }                  from 'happy-dom'
import { type Targets, transform } from 'lightningcss'
import { resolveConfig }           from 'vite'

import { LAYER } from '../config/layer.ts'
import { Chunk } from './chunk.ts'
import { Sheet } from './sheet.ts'

const DIST = join('.vitepress', 'dist')
/**
 * Pairs each kind of query with the `@theme` namespace holding the widths it
 * may name.
 */
const WIDTHS = [['container', 'container'], ['media', 'breakpoint']] as const

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
      ...await this.#folded(),
      ...this.#layered(),
      ...this.#outside()
    ]

    defects.forEach((defect) => write(defect))

    return Math.sign(defects.length)
  }

  /**
   * Lists each `color-mix()` call of the theme that the minifier replaced with
   * the fixed color it computes, since no built stylesheet holds the call as
   * Lightning CSS writes it under the targets the build passes.
   */
  async #folded(): Promise<string[]> {
    const config  = { configFile: false, css: { transformer: 'lightningcss' }, logLevel: 'silent' } as const
    const { css } = await resolveConfig(config, 'build')
    const built   = new Set(this.#sheets.flatMap(({ mixes }) => mixes))

    return this.#sources.flatMap(({ file, mixes }) => mixes
      .filter((mix) => !minified(mix, css.lightningcss?.targets).some((kept) => built.has(kept)))
      .map((mix) => `${file}: the minifier folds ${flat(mix)} into a fixed color`))
  }

  /**
   * Lists each built stylesheet naming `LAYER` after another cascade layer, and
   * each property a built rule sets outside every layer that no rule of the
   * theme sets there, as a default-theme rule the plugin left unwrapped does.
   */
  #layered(): string[] {
    const own = new Set(this.#sources.flatMap(({ unlayered }) => unlayered))

    return this.#sheets.flatMap(({ file, layers, unlayered }) => [
      ...layers.indexOf(LAYER) > 0 ? [`${file}: names the ${layers[0]} layer ahead of ${LAYER}`] : [],
      ...unlayered.filter((set) => !own.has(set)).map((set) => `${file}: ${set} sits outside every layer`)
    ])
  }

  /**
   * Lists each defect of the built rules outside `LAYER`, meaning:
   *
   * - A query naming a width the theme's `@theme` declares none of
   * - A color property set to a bare number, which no color is
   * - A `color-mix()` toward black, which the minifier folds into another color
   */
  #outside(): string[] {
    const widths = WIDTHS.map(([kind, namespace]) =>
      [kind, new Set(this.#sources.flatMap((sheet) => sheet.theme(namespace)))] as const
    )

    return this.#sheets.map((sheet) => sheet.outside(LAYER)).flatMap((sheet) => [
      ...widths.flatMap(([kind, declared]) => sheet.widths(kind)
        .filter((width) => !declared.has(width))
        .map((width) => `${sheet.file}: a ${kind} query names ${width}, a width the theme declares none of`)),
      ...sheet.uncolored.map((set) => `${sheet.file}: ${set} sets a color to a number`),
      ...sheet.mixes
        .filter((mix) => /\bblack\b/.test(mix))
        .map((mix) => `${sheet.file}: ${flat(mix)} mixes toward black`)
    ])
  }

  /**
   * Lists each built rule keyed on an image address that matches no element
   * on any page, which is what a rule naming a source image does once Vite
   * rewrites the image's address to a hashed one under `/assets/`, or to a
   * `data:` URL for an image under its 4096-byte inline limit.
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

/**
 * Collapses each run of whitespace in `mix` to one space and drops the space
 * after an opening parenthesis or before a closing one, so the call reads on
 * one line.
 */
function flat(mix: string): string {
  return mix.replaceAll(/\s+/g, ' ').replaceAll(/(?<=\() | (?=\))/g, '')
}

/**
 * Runs `mix` through the transform and the minify passes Vite runs under
 * `targets`, listing each `color-mix()` call the result holds.
 */
function minified(mix: string, targets: Targets | undefined): string[] {
  const pass = (code: string, minify: boolean): string => new TextDecoder().decode(
    transform({ code: Buffer.from(code), filename: 'mix.css', minify, targets }).code
  )

  return new Sheet('mix.css', pass(pass(`a{color:${mix}}`, false), true)).mixes
}
