import { readFile } from 'node:fs/promises'

import { expect, it } from 'vitest'

import { Typeface } from '../../../lib/type/typeface.ts'

const UPEM   = 2000  // Bodoni Moda's font units to the em, at which a pixel is one unit
const axes   = { opsz: 36, wght: 600 }
const bodoni = await readFile(new URL('../../../fonts/bodoni-moda/bodoni-moda.ttf', import.meta.url))
const face   = new Typeface(bodoni)

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
  const kerned = new Typeface(bodoni, { Wr: -160 })
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
