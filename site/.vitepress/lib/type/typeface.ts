import { Blob, Buffer, Face, Font, Variation, shape } from 'harfbuzzjs'

import { tenth } from '../daylight/tenth.ts'

/**
 * How a line of type is set, `size` in pixels to the em and `track` in pixels
 * between letters.
 */
interface Settings {
  size   : number
  axes?  : Readonly<Record<string, number>>
  track? : number
}

/**
 * Lists the variable font file of each face beneath the site's `.vitepress`
 * directory.
 */
export const FONT_FILES = {
  display : 'fonts/bodoni-moda/bodoni-moda.ttf',
  italic  : 'fonts/source-serif-4/source-serif-4-italic.ttf',
  mono    : 'fonts/jetbrains-mono/jetbrains-mono.ttf',
  serif   : 'fonts/source-serif-4/source-serif-4.ttf'
}

/**
 * A shaped line of type, its outlines in whole font units with y running up
 * from the baseline and its measures in pixels from the pen.
 */
export class Setting {
  readonly d      : string
  readonly ink    : { bottom: number, left: number, right: number, top: number }
  readonly width  : number
  readonly #scale : number

  constructor(d: string, ink: Setting['ink'], scale: number, width: number) {
    this.d      = d
    this.ink    = ink
    this.width  = width
    this.#scale = scale
  }

  /**
   * Writes the transform that places the outlines' pen at `x` on the baseline
   * `y` of a drawing whose y runs down.
   */
  transformAt(x: number, y: number): string {
    return `translate(${tenth(x)} ${tenth(y)}) scale(${this.#scale} ${-this.#scale})`
  }
}

/**
 * Shapes text in one font file through harfbuzzjs and outlines the result, so a
 * drawing's words depend on no font the reader's machine holds.
 */
export class Typeface {
  readonly #font  : Font
  readonly #pairs : Readonly<Record<string, number>>

  /**
   * Loads the font in `file`.
   *
   * Args:
   *   pairs: The kerning in font units each pair of letters adds to the file's
   *     own.
   */
  constructor(file: Uint8Array, pairs: Readonly<Record<string, number>> = {}) {
    this.#font  = fontOf(file)
    this.#pairs = pairs
  }

  /**
   * Shapes `text`, failing on a letter the font draws no glyph for.
   */
  set(text: string, { axes = {}, size, track = 0 }: Settings): Setting {
    const scale = size / this.#font.face.upem

    this.#font.setVariations(Object.entries(axes).map(([tag, value]) => new Variation(tag, value)))

    const glyphs = shaped(this.#font, text)
    const ink    = { bottom: Infinity, left: Infinity, right: -Infinity, top: -Infinity }
    let d        = ''
    let pen      = 0

    glyphs.forEach(({ cluster, codepoint, xAdvance = 0, xOffset = 0, yOffset = 0 }, index) => {
      if (codepoint === 0) throw new Error(`The typeface draws no glyph for a letter of ${text}`)

      const extents = this.#font.glyphExtents(codepoint)
      const left    = pen + xOffset
      const next    = glyphs[index + 1]?.cluster

      d += outlineOf(this.#font, codepoint, left, yOffset)

      if (extents !== undefined && extents.width !== 0) {
        ink.bottom = Math.min(ink.bottom, yOffset + extents.yBearing + extents.height)
        ink.left   = Math.min(ink.left, left + extents.xBearing)
        ink.right  = Math.max(ink.right, left + extents.xBearing + extents.width)
        ink.top    = Math.max(ink.top, yOffset + extents.yBearing)
      }

      const kern = next === undefined ? 0 : (this.#pairs[text[cluster]! + text[next]!] ?? 0) + track / scale

      pen += xAdvance + kern
    })

    return new Setting(
      d,
      { bottom: ink.bottom * scale, left: ink.left * scale, right: ink.right * scale, top: ink.top * scale },
      scale,
      pen * scale
    )
  }
}

/**
 * Opens the font in `file`.
 */
export function fontOf(file: Uint8Array): Font {
  return new Font(new Face(new Blob(file)))
}

/**
 * Writes the outline of glyph `id` as path data in whole font units, its pen at
 * `x`, `y`.
 */
export function outlineOf(font: Font, id: number, x = 0, y = 0): string {
  return font.glyphToJson(id)
    .map(({ type, values }) =>
      type + values.map((value, at) => Math.round(value + (at % 2 ? y : x))).join(' ')
    )
    .join('')
}

/**
 * Shapes `text` in `font` at the variations it holds, listing a position for
 * each glyph.
 */
export function shaped(font: Font, text: string) {
  const buffer = new Buffer()

  buffer.addText(text)
  buffer.guessSegmentProperties()
  shape(font, buffer)

  return buffer.getGlyphInfosAndPositions()
}
