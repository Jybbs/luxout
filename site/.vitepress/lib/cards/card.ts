import { Resvg }           from '@resvg/resvg-js'
import { wcagContrast }    from 'culori'
import { quantile, range } from 'd3-array'
import { type VNode, h }   from 'vue'
import { renderToString }  from 'vue/server-renderer'

import manifest        from '../../../../package.json' with { type: 'json' }
import { tenth }       from '../daylight/tenth.ts'
import type * as faces from './faces.ts'

/**
 * A rectangle on a card, its corner at `x`, `y`.
 */
export interface Box {
  height : number
  width  : number
  x      : number
  y      : number
}

export type Point = readonly [x: number, y: number]

/**
 * A gradient stop at the share `at` along it, opaque unless `alpha` is set.
 */
type Stop = readonly [at: number, color: string, alpha?: number]

/**
 * A word a card sets, and the layer that draws it.
 */
interface Word {
  fill : string
  part : VNode
  text : string
}

/**
 * The site's address as a card prints it.
 */
export const ADDRESS = new URL(manifest.homepage).host
export const HEIGHT  = 630
const OPAQUE         = 200  // The alpha from which a pixel of a word's outline counts as ink
export const WIDTH   = 1200

/**
 * One link card under construction, its gradients, clips, and filters beside
 * the layers it draws, rasterized through `@resvg/resvg-js` on the dark
 * scheme's ground.
 */
export class Card {
  readonly #body   : VNode[] = []
  readonly #defs   : VNode[] = []
  readonly #faces  : faces.Faces
  readonly #ground : string
  readonly #words  : Word[] = []

  constructor(fonts: faces.Faces, ground: string) {
    this.#faces  = fonts
    this.#ground = ground
  }

  /**
   * Lists the words the card sets, in the order it draws them.
   */
  get said(): readonly string[] {
    return this.#words.map(({ text }) => text)
  }

  /**
   * Declares a gradient across the card's width, its `steps + 1` even stops
   * colored by each stop's share of the width.
   *
   * Returns:
   *   The reference a `fill` attribute takes.
   */
  across(steps: number, colorAt: (share: number) => string): string {
    return this.linear([0, 0], [WIDTH, 0], range(steps + 1).map((step) =>
      [step / steps, colorAt(step / steps)] as const
    ))
  }

  add(...parts: VNode[]): void {
    this.#body.push(...parts)
  }

  /**
   * Measures the contrast each word holds against the pixels under its ink, at
   * the second percentile, which leaves out the pixels a blurred edge passes
   * through.
   */
  async audit(): Promise<{ contrast: number, text: string }[]> {
    const words  = new Set(this.#words.map(({ part }) => part))
    const behind = await this.#raster(this.#svg(this.#body.filter((part) => !words.has(part))))
    const share  = (at: number) => behind[at]! / 255

    return Promise.all(this.#words.map(async ({ fill, part, text }) => {
      const ink  = await this.#raster(this.#svg([part], false))
      const seen = ink.keys()
        .filter((at) => at % 4 === 0 && ink[at + 3]! > OPAQUE)
        .map((at) => wcagContrast(fill, { b: share(at + 2), g: share(at + 1), mode: 'rgb', r: share(at) }))

      return { contrast: quantile(seen, 0.02)!, text }
    }))
  }

  /**
   * Groups `parts` under a Gaussian blur declared across the whole card.
   */
  blurred(deviation: number, opacity: number, parts: VNode[]): VNode {
    const filter = this.#define('filter', {
      filterUnits : 'userSpaceOnUse',
      height      : HEIGHT + 400,
      width       : WIDTH + 400,
      x           : -200,
      y           : -200
    }, [h('feGaussianBlur', { stdDeviation: deviation })])

    return h('g', { filter, opacity }, parts)
  }

  /**
   * Declares a clip to `shapes`.
   *
   * Returns:
   *   The reference a `clip-path` attribute takes.
   */
  clip(...shapes: VNode[]): string {
    return this.#define('clipPath', {}, shapes)
  }

  /**
   * Declares a linear gradient from `from` to `to`.
   *
   * Returns:
   *   The reference a `fill` attribute takes.
   */
  linear(from: Point, to: Point, stops: readonly Stop[]): string {
    return this.#define('linearGradient', {
      gradientUnits : 'userSpaceOnUse',
      x1            : tenth(from[0]),
      x2            : tenth(to[0]),
      y1            : tenth(from[1]),
      y2            : tenth(to[1])
    }, stops.map(([offset, color, alpha = 1]) =>
      h('stop', { offset, 'stop-color': color, 'stop-opacity': alpha })
    ))
  }

  async png(): Promise<Uint8Array> {
    return (await this.#render(this.#svg(this.#body))).asPng()
  }

  /**
   * Sets `text` in `voice` as an outline.
   */
  say(text: string, voice: faces.Voice, saying: faces.Saying): void {
    const part = this.#faces.say(text, voice, saying)

    this.#words.push({ fill: saying.fill, part, text })
    this.add(part)
  }

  #define(tag: string, props: Record<string, number | string>, children: VNode[]): string {
    const id = `c${this.#defs.length}`

    this.#defs.push(h(tag, { ...props, id }, children))

    return `url(#${id})`
  }

  async #raster(drawing: VNode): Promise<Uint8Array> {
    return (await this.#render(drawing)).pixels
  }

  async #render(drawing: VNode) {
    return new Resvg(await renderToString(drawing), {
      fitTo : { mode: 'width', value: WIDTH },
      font  : { loadSystemFonts: false }
    }).render()
  }

  #svg(parts: readonly VNode[], grounded = true): VNode {
    const size = { height: HEIGHT, width: WIDTH }

    return h('svg', { ...size, viewBox: `0 0 ${WIDTH} ${HEIGHT}`, xmlns: 'http://www.w3.org/2000/svg' }, [
      h('defs', this.#defs),
      ...grounded ? [h('rect', { ...size, fill: this.#ground })] : [],
      ...parts
    ])
  }
}

/**
 * Grows `box` by `by` on every side.
 */
export function around({ height, width, x, y }: Box, by: number): Box {
  return { height: height + 2 * by, width: width + 2 * by, x: x - by, y: y - by }
}

/**
 * Names the card of the Markdown file `page`, beneath the build's output.
 */
export function cardPath(page: string): string {
  return `cards/${page.replace(/\.md$/, '')}.png`
}

export function polygon(points: readonly Point[], props: Record<string, number | string> = {}): VNode {
  return h('polygon', { ...props, points: points.map(([x, y]) => `${tenth(x)},${tenth(y)}`).join(' ') })
}

export function rect({ height, width, x, y }: Box, props: Record<string, number | string> = {}): VNode {
  return h('rect', { ...props, height: tenth(height), width: tenth(width), x: tenth(x), y: tenth(y) })
}
