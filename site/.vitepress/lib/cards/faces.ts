import { readFile } from 'node:fs/promises'

import { type VNode, h } from 'vue'

import * as typeface from '../type/typeface.ts'

type Face = keyof typeof typeface.FONT_FILES

/**
 * A place in a drawing and how a word aligns there, by its ink's left edge,
 * right edge, or middle, so a side bearing never moves it off an edge it
 * shares.
 */
export interface Saying {
  fill    : string
  size    : number
  x       : number
  y       : number
  anchor? : 'end' | 'middle' | 'start'
}

/**
 * A face at the axes and tracking a card's words take.
 */
export interface Voice {
  axes   : Readonly<Record<string, number>>
  face   : Face
  track? : number
}

/**
 * The voice of a drawing's display words, a start card's word and the credit's
 * heading.
 */
export const DISPLAY: Voice = { axes: { opsz: 12, wght: 600 }, face: 'display' }
/**
 * The voice of a card's address and of the unit beside its reading.
 */
export const MONO: Voice = { axes: { wght: 500 }, face: 'mono' }
/**
 * Closes the gap after `W` in font units in each pair a page title sets, since
 * Bodoni Moda's `GPOS` table kerns W against no lowercase letter.
 */
const PAIRS: Partial<Record<Face, Readonly<Record<string, number>>>> = { display: { Wh: -160, Wi: -160 } }

/**
 * The faces the drawings set their words in, the body face's italic among them.
 */
export class Faces {
  readonly #faces: Record<Face, typeface.Typeface>

  /**
   * Reads each face's font file from beneath `root`, the site's `.vitepress`
   * directory.
   */
  static async read(root: URL): Promise<Faces> {
    const faces = await Promise.all(Object.entries(typeface.FONT_FILES).map(async ([face, file]) =>
      [face, new typeface.Typeface(await readFile(new URL(file, root)), PAIRS[face as Face])] as const
    ))

    return new Faces(Object.fromEntries(faces) as Record<Face, typeface.Typeface>)
  }

  constructor(faces: Record<Face, typeface.Typeface>) {
    this.#faces = faces
  }

  /**
   * Sets `text` in `voice` as an outline placed where `saying` puts it.
   */
  say(text: string, voice: Voice, { anchor = 'start', fill, size, x, y }: Saying): VNode {
    const setting         = this.set(voice, size, text)
    const { left, right } = setting.ink
    const pens            = { end: x - right, middle: x - (left + right) / 2, start: x - left }

    return h('path', { d: setting.d, fill, transform: setting.transformAt(pens[anchor], y) })
  }

  set({ face, ...settings }: Voice, size: number, text: string): typeface.Setting {
    return this.#faces[face].set(text, { ...settings, size })
  }
}
