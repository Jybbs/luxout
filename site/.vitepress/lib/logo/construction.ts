import type { Scheme } from '../theme/tokens.ts'

/**
 * The measurements and colors the logo takes, the o of its word drawn as the
 * sun.
 */
export interface Construction {
  below   : Record<Scheme, number>
  frame   : number
  glow    : { radius: number, stops: readonly { offset: number, opacity: number }[] }
  horizon : { gap: number, opacity: number, stroke: { mark: number, title: number } }
  ink     : Record<Scheme, string>
  mark    : number
  opsz    : number
  sun     : string
  weight  : { letters: number, sun: number }
  word    : string
}

/**
 * Sets Bodoni Moda at the optical size it takes at 120 px, where:
 *
 * - `below` is the ink's opacity under the horizon in each scheme.
 * - `frame` is the title's margin past the word, in font sizes.
 * - `glow.radius`, `horizon.gap`, and `mark` are multiples of the o's
 *   half-width, the gap measured from the o's center to each end of the break
 *   and `mark` the side of the mark's square.
 * - `horizon.stroke` is the horizon's thickness in font sizes.
 * - `ink` and `sun` name the tokens each color reads.
 */
export const CONSTRUCTION: Construction = {
  below   : { dark: 0.38, light: 0.3 },
  frame   : 0.3,
  horizon : { gap: 1.35, opacity: 0.55, stroke: { mark: 0.05, title: 0.011 } },
  ink     : { dark: '--luxout-ground', light: '--luxout-dark' },
  mark    : 6,
  opsz    : 96,
  sun     : '--luxout-primary',
  weight  : { letters: 600, sun: 800 },
  word    : 'Luxout',
  glow    : {
    radius : 2.6,
    stops  : [
      { offset: 0, opacity: 0 },
      { offset: 0.42, opacity: 0 },
      { offset: 0.5, opacity: 0.5 },
      { offset: 1, opacity: 0 }
    ]
  }
}
