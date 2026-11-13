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
 * Closes the gap after `W` in font units in each pair a page title sets, since
 * Bodoni Moda's `GPOS` table kerns W against no lowercase letter.
 */
const DISPLAY_PAIRS = { Wh: -160, Wi: -160 }
/**
 * The voice of a card's address and of the unit beside its reading.
 */
export const MONO: Voice = { axes: { wght: 500 }, face: 'mono' }

/**
 * The three faces the cards set their words in.
 */
export class Faces {
  readonly #faces: Record<Face, typeface.Typeface>

  /**
   * Reads each face's font file from beneath `root`, the site's `.vitepress`
   * directory.
   */
  static async read(root: URL): Promise<Faces> {
    const file                   = (face: Face) => readFile(new URL(typeface.FONT_FILES[face], root))
    const [display, mono, serif] = await Promise.all([file('display'), file('mono'), file('serif')])

    return new Faces({
      display : new typeface.Typeface(display, DISPLAY_PAIRS),
      mono    : new typeface.Typeface(mono),
      serif   : new typeface.Typeface(serif)
    })
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
