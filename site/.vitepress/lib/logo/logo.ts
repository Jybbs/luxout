import { readFile }      from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { noop }                      from '@vueuse/core'
import { type VNode, cloneVNode, h } from 'vue'

import { Faces, MONO }                     from '../cards/faces.ts'
import { pageOpening }                     from '../config/pages.ts'
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

/**
 * The faces the lockup sets its tagline in and the tagline it sets, the
 * paragraph opening the site's front page.
 */
interface Lettering {
  faces   : Faces
  tagline : string
}

/**
 * The color the letters above the horizon take, the scheme's ink where it is
 * left out, and the text every id a drawing defines opens on.
 */
interface Paint {
  above?  : string
  prefix? : string
}

export const ASSETS = ['lockup', 'mark', 'title'] as const

/**
 * Draws the logo's lockup, title, and mark in either scheme from the
 * construction, with every coordinate of the title and the mark on a whole font
 * unit.
 */
export class Logo {
  readonly #construction : Construction
  readonly #lettering    : Lettering
  readonly #tokens       : Tokens
  readonly #word         : wordmark.Wordmark

  /**
   * Reads Bodoni Moda, the faces, and the theme's tokens from beneath `root`,
   * the site's `.vitepress` directory, and the tagline from the front page
   * beside it.
   */
  static async read(root: URL, construction: Construction = CONSTRUCTION): Promise<Logo> {
    const [font, faces, tokens] = await Promise.all([
      readFile(new URL(FONT_FILES.display, root)),
      Faces.read(root),
      Tokens.read(root)
    ])
    const tagline = pageOpening(fileURLToPath(new URL('../index.md', root)))

    return new Logo(tokens, wordmark.measure(font, construction), construction, { faces, tagline })
  }

  constructor(tokens: Tokens, word: wordmark.Wordmark, construction: Construction, lettering: Lettering) {
    this.#construction = construction
    this.#lettering    = lettering
    this.#tokens       = tokens
    this.#word         = word
  }

  /**
   * Reads the depth of the title's horizon below its top, its height, its ink's
   * two ends, its sun's radius, and the width of its horizon's line, each as a
   * share of the title's width.
   */
  get shares(): { height: number, horizon: number, left: number, line: number, right: number, sun: number } {
    const { ascent, descent, ink, size, sun, width } = this.#word

    const margin = this.#margin
    const across = width + 2 * margin

    return {
      height  : (ascent - descent + 2 * margin) / across,
      horizon : (ascent + margin - sun.cy) / across,
      left    : (ink.left + margin) / across,
      line    : Math.round(size * this.#construction.horizon.stroke.title) / across,
      right   : (ink.right + margin) / across,
      sun     : sun.r / across
    }
  }

  get #margin(): number {
    return Math.round(this.#word.size * this.#construction.frame)
  }

  /**
   * Draws the title for the front page's hero in `scheme`, its letters above
   * the horizon in `currentColor` so the page sets them against the sky behind
   * them, and every id it defines opening on `scheme`, so the two schemes'
   * drawings share a page.
   */
  hero(scheme: Scheme): VNode {
    return this.#title(scheme, { above: 'currentColor', prefix: `${scheme}-` })
  }

  /**
   * Draws the title `lockup.width` pixels wide over the tagline in capitals,
   * tracked so its ink runs the length of the horizon, the drawing cropped from
   * the top of the glow to half the tagline's size below its baseline.
   */
  lockup(scheme: Scheme): VNode {
    const { glow, ink, lockup, word } = this.#construction
    const { faces, tagline }          = this.#lettering
    const shares                      = this.shares

    const left     = shares.left * lockup.width
    const right    = shares.right * lockup.width
    const horizon  = shares.horizon * lockup.width
    const baseline = horizon + shares.sun * lockup.below * lockup.width
    const top      = Math.floor(horizon - shares.sun * glow.radius * lockup.width)
    const height   = Math.ceil(baseline + lockup.size / 2) - top
    const capitals = tagline.toUpperCase().replace(/\.$/, '')
    const plain    = faces.set(MONO, lockup.size, capitals).ink
    const track    = (right - left - plain.right + plain.left) / (capitals.length - 1)

    return h('svg', {
      'aria-label' : `${word}. ${tagline}`,
      height       : height,
      role         : 'img',
      viewBox      : `0 ${top} ${lockup.width} ${height}`,
      width        : lockup.width,
      xmlns        : SVG_NAMESPACE
    }, [
      this.titleAcross(left, right, scheme, horizon),
      faces.say(capitals, { ...MONO, track }, {
        fill : this.#tokens.resolve(ink[scheme], scheme),
        size : lockup.size,
        x    : left,
        y    : baseline
      })
    ])
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
      scheme,
      {}
    )
  }

  /**
   * Draws the word on a horizon running from its first letter's left edge to
   * its last letter's right edge, framed past its width, ascent, and descent.
   */
  title(scheme: Scheme): VNode {
    return this.#title(scheme)
  }

  /**
   * Draws the title inside a larger drawing, its ink running from `left` to
   * `right` and its horizon on `y`, all in that drawing's units.
   */
  titleAcross(left: number, right: number, scheme: Scheme, y: number): VNode {
    const shares = this.shares
    const across = (right - left) / (shares.right - shares.left)

    return cloneVNode(this.title(scheme), {
      height : tenth(shares.height * across),
      width  : tenth(across),
      x      : tenth(left - shares.left * across),
      y      : tenth(y - shares.horizon * across)
    })
  }

  #draw(
    { bottom, horizon, left, right, top } : Frame,
    glyphs                                : readonly wordmark.Glyph[],
    scheme                                : Scheme,
    { above, prefix = '' }                : Paint
  ): VNode {
    const { below, glow, ink, sun } = this.#construction
    const { cx, cy, r }             = this.#word.sun

    const colors  = { ink: this.#tokens.resolve(ink[scheme], scheme), sun: this.#tokens.resolve(sun, scheme) }
    const url     = (id: string) => `url(#${prefix}${id})`
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
        h('clipPath', { id: `${prefix}sky` }, [
          h('rect', { height: top - cy, width: across, x: left, y: cy })
        ]),
        h('clipPath', { id: `${prefix}land` }, [
          h('rect', { height: cy - bottom, width: across, x: left, y: bottom })
        ]),
        h(
          'radialGradient',
          { cx, cy, gradientUnits: 'userSpaceOnUse', id: `${prefix}glow`, r: radius },
          glow.stops.map(({ offset, opacity }) =>
            h('stop', { offset, 'stop-color': colors.sun, 'stop-opacity': opacity })
          )
        )
      ]),
      h('g', { transform: 'scale(1 -1)' }, [
        h('circle', { 'clip-path': url('sky'), cx, cy, fill: url('glow'), r: radius }),
        h('g', { 'clip-path': url('sky'), 'fill': above ?? colors.ink }, sunlit),
        h('g', { 'clip-path': url('land'), 'fill': colors.ink, 'fill-opacity': below[scheme] }, dimmed),
        h('g', { 'fill': colors.ink, 'fill-opacity': this.#construction.horizon.opacity }, [
          h('rect', { height: stroke, width: cx - opening - horizon.from, x: horizon.from, y: edge }),
          h('rect', { height: stroke, width: horizon.to - cx - opening, x: cx + opening, y: edge })
        ])
      ])
    ])
  }

  #title(scheme: Scheme, paint: Paint = {}): VNode {
    const { ascent, descent, glyphs, ink, width } = this.#word

    const margin  = this.#margin
    const horizon = { from: ink.left, stroke: this.#construction.horizon.stroke.title, to: ink.right }

    return this.#draw(
      { bottom: descent - margin, horizon, left: -margin, right: width + margin, top: ascent + margin },
      glyphs,
      scheme,
      paint
    )
  }
}

/**
 * Names the address the site serves `asset` at in `scheme`, beneath its public
 * directory.
 */
export function addressOf(asset: Asset, scheme: Scheme): string {
  return `/logo/${asset}-${scheme}.svg`
}
