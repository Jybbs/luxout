import { readFile }             from 'node:fs/promises'
import { basename }             from 'node:path'
import { brotliDecompressSync } from 'node:zlib'

import { sum }        from 'd3-array'
import { expect, it } from 'vitest'

import * as typeface from '../../../lib/type/typeface.ts'

/**
 * The index a WOFF2 table directory gives each table it names by number rather
 * than by tag, from the known table tags of the WOFF File Format 2.0
 * recommendation.
 */
const KNOWN  = { glyf: 10, head: 1, loca: 11 }
const UPEM   = 2000  // Bodoni Moda's font units to the em, at which a pixel is one unit
const axes   = { opsz: 36, wght: 600 }
const bodoni = await readFile(new URL('../../../fonts/bodoni-moda/bodoni-moda.ttf', import.meta.url))
const face   = new typeface.Typeface(bodoni)

/**
 * Reads the `head` table out of a WOFF2 file, whose tables follow the 48-byte
 * header and the table directory as one Brotli stream, each at the length its
 * directory entry gives.
 */
function headOf(woff2: Uint8Array): Uint8Array {
  const view = new DataView(woff2.buffer, woff2.byteOffset)
  let at     = 48

  const base128 = (value = 0): number => {
    const byte = woff2[at++]!

    return byte < 0x80 ? value * 0x80 + byte : base128(value * 0x80 + byte - 0x80)
  }
  const tables  = Array.from({ length: view.getUint16(12) }, () => {
    const flags = woff2[at++]!
    const known = flags & 0x3f

    at += known === 0x3f ? 4 : 0

    const length = base128()
    const glyphs = known === KNOWN.glyf || known === KNOWN.loca

    // A transformed table, `glyf` or `loca` at version 0 and any other at 1, gives a second length.
    return { known, length: glyphs === flags < 0x40 ? base128() : length }
  })
  const stream  = brotliDecompressSync(woff2.subarray(at, at + view.getUint32(20)))
  const head    = tables.findIndex(({ known }) => known === KNOWN.head)
  const start   = sum(tables.slice(0, head), ({ length }) => length)

  return stream.subarray(start, start + tables[head]!.length)
}

/**
 * Reads the `fontRevision` a `head` table holds as 16.16 fixed point, to the
 * three places a font's version string gives.
 */
function revisionOf(head: Uint8Array): string {
  return (new DataView(head.buffer, head.byteOffset).getUint32(4) / 0x10000).toFixed(3)
}

it('writes the outlines in whole font units', () => {
  expect(face.set('Luxout', { axes, size: 80 }).d).not.toMatch(/\.\d/)
})

it('scales the measures with the size', () => {
  const small = face.set('Luxout', { axes, size: 40 })
  const large = face.set('Luxout', { axes, size: 80 })

  expect(large.width).toBeCloseTo(small.width * 2, 6)
  expect(large.ink.top).toBeCloseTo(small.ink.top * 2, 6)
})

it('holds the ink inside its pen and above its baseline for a letter with no descender', () => {
  const { ink, width } = face.set('H', { axes, size: 100 })

  expect(ink.left).toBeGreaterThanOrEqual(0)
  expect(ink.right).toBeLessThanOrEqual(width)
  expect(ink.bottom).toBeCloseTo(0, 0)
  expect(ink.top).toBeGreaterThan(50)
})

it('adds tracking between letters and none past the last', () => {
  const plain   = face.set('Lux', { axes, size: 40 }).width
  const tracked = face.set('Lux', { axes, size: 40, track: 5 }).width

  expect(tracked - plain).toBeCloseTo(10, 6)
})

it('adds the kerning of a pair the font leaves out, and none to another pair', () => {
  const kerned = new typeface.Typeface(bodoni, { Wr: -160 })
  const moved  = (text: string) =>
    face.set(text, { axes, size: UPEM }).width - kerned.set(text, { axes, size: UPEM }).width

  expect(moved('Wr')).toBeCloseTo(160, 0)
  expect(moved('Lu')).toBe(0)
})

it('fails on a letter the font draws no glyph for', () => {
  expect(() => face.set('\u{1F506}', { axes, size: 40 })).toThrow('no glyph')
})

it('places the pen where the transform names, on a baseline whose y runs down', () => {
  expect(face.set('H', { axes, size: 100 }).transformAt(10.04, 20.06))
    .toMatch(/^translate\(10 20\.1\) scale\(0\.\d+ -0\.\d+\)$/)
})

it.each(Object.entries(typeface.FONT_FILES).map(([name, file]) => ({ file, name })))(
  'outlines the $name face at the font revision its Fontsource package serves',
  async ({ file }) => {
    const id             = basename(file, '.ttf')
    const [kept, served] = await Promise.all([
      readFile(new URL(`../../../${file}`, import.meta.url)),
      readFile(new URL(import.meta.resolve(`@fontsource-variable/${id}/files/${id}-latin-wght-normal.woff2`)))
    ])

    expect(revisionOf(typeface.fontOf(kept).face.referenceTable('head')!)).toBe(revisionOf(headOf(served)))
  }
)
