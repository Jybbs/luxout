import { readFile } from 'node:fs/promises'

import * as typeface from '../type/typeface.ts'

type Face = keyof typeof typeface.FONT_FILES

/**
 * A face at the axes and tracking a card's words take.
 */
export interface Voice {
  axes   : Readonly<Record<string, number>>
  face   : Face
  track? : number
}

/**
 * Closes the gap of `Wr` in font units, since Bodoni Moda's `GPOS` table kerns
 * T, V, and Y against lowercase letters and holds no pair for W.
 */
const DISPLAY_PAIRS = { Wr: -160 }
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

  set({ face, ...settings }: Voice, size: number, text: string): typeface.Setting {
    return this.#faces[face].set(text, { ...settings, size })
  }
}
