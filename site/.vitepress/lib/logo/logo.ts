import { readFile } from 'node:fs/promises'

import { noop }                      from '@vueuse/core'
import { type VNode, cloneVNode, h } from 'vue'

import { SVG_NAMESPACE }                   from '../daylight/svg.ts'
import { tenth }                           from '../daylight/tenth.ts'
import { type Scheme, Tokens }             from '../theme/tokens.ts'
import { FONT_FILES }                      from '../type/typeface.ts'
import { CONSTRUCTION, type Construction } from './construction.ts'
import * as wordmark                       from './wordmark.ts'

type Asset = (typeof ASSETS)[number]

/**
 * The box a drawing fills and the stretch its horizon runs, in whole font units
 * with y running up from the baseline, the horizon `stroke` thick as a share of
 * the font size.
 */
interface Frame {
  bottom  : number
  horizon : { from: number, stroke: number, to: number }
  left    : number
  right   : number
  top     : number
}

export const ASSETS = ['mark', 'title'] as const

/**
 * Draws the logo's title and mark in either scheme from the construction, with
 * every coordinate on a whole font unit.
 */
export class Logo {
  readonly #construction : Construction
  readonly #tokens       : Tokens
  readonly #word         : wordmark.Wordmark

  /**
   * Reads Bodoni Moda and the theme's tokens from beneath `root`, the site's
   * `.vitepress` directory.
   */
  static async read(root: URL, construction: Construction = CONSTRUCTION): Promise<Logo> {
    const [font, tokens] = await Promise.all([readFile(new URL(FONT_FILES.display, root)), Tokens.read(root)])

    return new Logo(tokens, wordmark.measure(font, construction), construction)
  }

  constructor(tokens: Tokens, word: wordmark.Wordmark, construction: Construction) {
    this.#construction = construction
    this.#tokens       = tokens
    this.#word         = word
  }

  get #margin(): number {
    return Math.round(this.#word.size * this.#construction.frame)
  }

  /**
   * Draws the o alone, centered in a square its horizon crosses from edge to
   * edge.
   */
  mark(scheme: Scheme): VNode {
    const { cx, cy, r } = this.#word.sun
    const half          = Math.round(r * this.#construction.mark / 2)
    const horizon       = { from: cx - half, stroke: this.#construction.horizon.stroke.mark, to: cx + half }

    return this.#draw(
      { bottom: cy - half, horizon, left: cx - half, right: cx + half, top: cy + half },
      this.#word.glyphs.filter(({ sun }) => sun),
      scheme
    )
  }

  /**
   * Draws the word on a horizon running from its first letter's left edge to
   * its last letter's right edge, framed past its width, ascent, and descent.
   */
  title(scheme: Scheme): VNode {
    const { ascent, descent, glyphs, ink, width } = this.#word

    const margin  = this.#margin
    const horizon = { from: ink.left, stroke: this.#construction.horizon.stroke.title, to: ink.right }

    return this.#draw(
      { bottom: descent - margin, horizon, left: -margin, right: width + margin, top: ascent + margin },
      glyphs,
      scheme
    )
  }

  /**
   * Draws the title inside a larger drawing, its ink running from `left` to
   * `right` and its horizon on `y`, all in that drawing's units.
   */
  titleAcross(left: number, right: number, scheme: Scheme, y: number): VNode {
    const { ascent, descent, ink, sun, width } = this.#word

    const margin = this.#margin
    const scale  = (right - left) / (ink.right - ink.left)

    return cloneVNode(this.title(scheme), {
      height : tenth((ascent - descent + 2 * margin) * scale),
      width  : tenth((width + 2 * margin) * scale),
      x      : tenth(left - (ink.left + margin) * scale),
      y      : tenth(y - (ascent + margin - sun.cy) * scale)
    })
  }

  #draw(
    { bottom, horizon, left, right, top } : Frame,
    glyphs                                : readonly wordmark.Glyph[],
    scheme                                : Scheme
  ): VNode {
    const { below, glow, ink, sun } = this.#construction
    const { cx, cy, r }             = this.#word.sun

    const colors  = { ink: this.#tokens.resolve(ink[scheme], scheme), sun: this.#tokens.resolve(sun, scheme) }
    const radius  = Math.round(r * glow.radius)
    const opening = Math.round(r * this.#construction.horizon.gap)
    const stroke  = Math.round(this.#word.size * horizon.stroke)
    const edge    = Math.round(cy - stroke / 2)
    const letters = (fill: (glyph: wordmark.Glyph) => string | void) => glyphs.map((glyph) =>
      h('path', { d: glyph.d, fill: fill(glyph), transform: `translate(${glyph.x})` })
    )
    const across = right - left
    const sunlit = letters((glyph) => glyph.sun ? colors.sun : undefined)
    const dimmed = letters(noop)

    return h('svg', { viewBox: `${left} ${-top} ${across} ${top - bottom}`, xmlns: SVG_NAMESPACE }, [
      h('defs', [
        h('clipPath', { id: 'sky' }, [h('rect', { height: top - cy, width: across, x: left, y: cy })]),
        h('clipPath', { id: 'land' }, [
          h('rect', { height: cy - bottom, width: across, x: left, y: bottom })
        ]),
        h(
          'radialGradient',
          { cx, cy, gradientUnits: 'userSpaceOnUse', id: 'glow', r: radius },
          glow.stops.map(({ offset, opacity }) =>
            h('stop', { offset, 'stop-color': colors.sun, 'stop-opacity': opacity })
          )
        )
      ]),
      h('g', { transform: 'scale(1 -1)' }, [
        h('circle', { 'clip-path': 'url(#sky)', cx, cy, fill: 'url(#glow)', r: radius }),
        h('g', { 'clip-path': 'url(#sky)', 'fill': colors.ink }, sunlit),
        h('g', { 'clip-path': 'url(#land)', 'fill': colors.ink, 'fill-opacity': below[scheme] }, dimmed),
        h('g', { 'fill': colors.ink, 'fill-opacity': this.#construction.horizon.opacity }, [
          h('rect', { height: stroke, width: cx - opening - horizon.from, x: horizon.from, y: edge }),
          h('rect', { height: stroke, width: horizon.to - cx - opening, x: cx + opening, y: edge })
        ])
      ])
    ])
  }
}

/**
 * Names the address the site serves `asset` at in `scheme`, beneath its public
 * directory.
 */
export function addressOf(asset: Asset, scheme: Scheme): string {
  return `/logo/${asset}-${scheme}.svg`
}
