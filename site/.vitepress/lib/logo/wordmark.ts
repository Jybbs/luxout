import { sum }                                     from 'd3-array'
import { type Font, type GlyphExtents, Variation } from 'harfbuzzjs'

import * as typeface          from '../type/typeface.ts'
import type { Construction } from './construction.ts'

/**
 * One letter of the word, its outline in whole font units with y running up
 * from the baseline at the pen position `x`.
 */
export interface Glyph {
  d   : string
  sun : boolean
  x   : number
}

interface Letter {
  advance : number
  d       : string
  extents : GlyphExtents
  id      : number
  sun     : boolean
}

/**
 * The word set as the logo sets it, in Bodoni Moda's font units, where the font
 * size is one em of `size` units and the sun's center sits on a whole unit.
 */
export interface Wordmark {
  ascent  : number
  descent : number
  glyphs  : readonly Glyph[]
  ink     : { left: number, right: number }
  size    : number
  sun     : { cx: number, cy: number, r: number }
  width   : number
}

function extentsOf(font: Font, id: number): GlyphExtents {
  const extents = font.glyphExtents(id)

  if (extents === undefined) throw new Error(`Bodoni Moda draws no outline for glyph ${id}`)

  return extents
}

/**
 * Shapes the construction's word in `file`, a variable Bodoni Moda, setting its
 * o at the sun's weight and moving each letter after the o right by the width
 * the heavier o adds.
 */
export function measure(file: Uint8Array, { opsz, weight, word }: Construction): Wordmark {
  const font  = typeface.fontOf(file)
  const weigh = (wght: number) =>
    font.setVariations([new Variation('opsz', opsz), new Variation('wght', wght)])
  const letter = (id: number, advance: number, sun: boolean): Letter => ({
    advance : advance,
    d       : typeface.outlineOf(font, id),
    extents : extentsOf(font, id),
    id      : id,
    sun     : sun
  })

  weigh(weight.letters)

  const regular = typeface.shaped(font, word)
    .map(({ cluster, codepoint, xAdvance = 0 }) => letter(codepoint, xAdvance, cluster === word.indexOf('o')))
  const o = regular.find(({ sun }) => sun)

  if (o === undefined) throw new Error(`The logo's word ${word} holds no o to draw as the sun`)

  const thin = font.glyphHAdvance(o.id)

  weigh(weight.sun)

  const heavy = letter(o.id, o.advance + font.glyphHAdvance(o.id) - thin, true)
  let pen     = 0
  const set   = regular.map((each) => {
    const placed = { ...(each.sun ? heavy : each), x: pen }

    pen += placed.advance

    return placed
  })
  const lefts = set.map(({ extents, x }) => x + extents.xBearing)
  const ends  = set.map(({ extents, x }) => x + extents.xBearing + extents.width)
  const until = sum(regular.slice(0, regular.indexOf(o)), ({ advance }) => advance)

  const { ascender, descender }               = font.hExtents()
  const { height, width, xBearing, yBearing } = heavy.extents
  const cx                                    = Math.round(until + xBearing + width / 2)

  return {
    ascent  : ascender,
    descent : descender,
    glyphs  : set.map(({ d, sun, x }) => ({ d, sun, x })),
    ink     : { left: Math.min(...lefts), right: Math.max(...ends) },
    size    : font.face.upem,
    sun     : { cx, cy: Math.round(yBearing + height / 2), r: width / 2 },
    width   : pen
  }
}
