import { fileURLToPath } from 'node:url'

import { scaleLinear }   from 'd3-scale'
import { type VNode, h } from 'vue'

import manifest                 from '../../../../package.json' with { type: 'json' }
import { TWILIGHT }             from '../../../../src/daylight/clear-sky.ts'
import * as faces               from '../cards/faces.ts'
import { pageTitle }            from '../config/pages.ts'
import { SampleDay, crossings } from '../daylight/sample-day.ts'
import { SVG_NAMESPACE }        from '../daylight/svg.ts'
import { tenth }                from '../daylight/tenth.ts'
import { CONSTRUCTION }         from '../logo/construction.ts'
import { type Scheme, Tokens }  from '../theme/tokens.ts'

/**
 * One card of the README's Where to Start row, the page it opens beneath the
 * site's root, the word it carries, and the minute of the sample day whose sun
 * it shows.
 */
interface StartCard {
  minute : (day: SampleDay) => number
  page   : string
  word   : string
}

/**
 * The card's parts in its own units, which the README shows at half size, the
 * word and the page's name set from `inset` and the sun standing at `sun.x`.
 */
const LAYOUT = {
  height  : 232,
  horizon : { stroke: 2, y: 150 },
  inset   : 40,
  name    : { size: 22, y: 190 },
  rx      : 20,
  sun     : { r: 22, x: 432 },
  width   : 520,
  word    : { size: 60, y: 110 }
}
export const START_CARDS: readonly StartCard[] = [
  {
    minute : ({ altitudes }) => crossings(altitudes, TWILIGHT.civil)[0],
    page   : 'estimate/index.md',
    word   : 'Understand'
  },
  {
    minute : ({ altitudes }) => crossings(altitudes, TWILIGHT.sunset)[0],
    page   : 'troubleshooting/index.md',
    word   : 'Check'
  },
  { minute: () => SampleDay.NOON, page: 'install/installing.md', word: 'Run' }
]

/**
 * Places the sun's center at an altitude in degrees, civil twilight carrying it
 * from wholly below the horizon up to the horizon and the rest of the sky
 * carrying it from there to the card's top edge at the zenith.
 */
const sunY = scaleLinear(
  [TWILIGHT.civil, 0, 90],
  [LAYOUT.horizon.y + LAYOUT.sun.r + LAYOUT.horizon.stroke, LAYOUT.horizon.y, LAYOUT.sun.r]
).clamp(true)

/**
 * Draws the README's start cards, each the sun at its page's minute of the
 * sample day on a horizon, drawn as the logo draws its o, beside its word and
 * above its page's name on the raised ground.
 */
export class StartCards {
  readonly #day    : SampleDay
  readonly #faces  : faces.Faces
  readonly #root   : URL
  readonly #tokens : Tokens

  /**
   * Reads the faces and the theme's tokens from beneath `root`, the site's
   * `.vitepress` directory.
   */
  static async read(root: URL): Promise<StartCards> {
    const [fonts, tokens] = await Promise.all([faces.Faces.read(root), Tokens.read(root)])

    return new StartCards(fonts, root, tokens)
  }

  constructor(fonts: faces.Faces, root: URL, tokens: Tokens) {
    this.#day    = SampleDay.record()
    this.#faces  = fonts
    this.#root   = root
    this.#tokens = tokens
  }

  /**
   * Draws `card` in `scheme`.
   */
  draw(card: StartCard, scheme: Scheme): VNode {
    const { height, inset, name, rx, width, word } = LAYOUT

    const color = (property: string) => this.#tokens.resolve(property, scheme)
    const title = this.title(card)
    const say   = (text: string, voice: faces.Voice, fill: string, at: Pick<faces.Saying, 'size' | 'y'>) =>
      this.#faces.say(text, voice, { ...at, fill, x: inset })

    return h('svg', {
      'aria-label' : `${card.word}: ${title}`,
      height       : height / 2,
      role         : 'img',
      viewBox      : `0 0 ${width} ${height}`,
      width        : width / 2,
      xmlns        : SVG_NAMESPACE
    }, [
      h('rect', {
        fill           : color('--vp-c-bg-soft'),
        height         : height - 2,
        rx             : rx,
        stroke         : color('--vp-c-divider'),
        'stroke-width' : 2,
        width          : width - 2,
        x              : 1,
        y              : 1
      }),
      ...this.#sun(card, scheme),
      say(card.word, faces.DISPLAY, color('--vp-c-text-1'), word),
      say(title, faces.MONO, color('--vp-c-text-2'), name)
    ])
  }

  /**
   * Reads the first heading of the page `card` opens.
   */
  title(card: StartCard): string {
    return pageTitle(fileURLToPath(new URL(`../${card.page}`, this.#root)))
  }

  /**
   * Draws the sun at `card`'s minute in the logo's colors, sunlit above the
   * horizon and faded below it, on a horizon as wide as the logo's mark.
   */
  #sun(card: StartCard, scheme: Scheme): VNode[] {
    const { below, horizon: line, ink, mark, sun: gold } = CONSTRUCTION
    const { height, horizon, sun, width }               = LAYOUT

    const cy    = tenth(sunY(this.#day.altitudes[card.minute(this.#day)]!))
    const half  = sun.r * mark / 2
    const inked = this.#tokens.resolve(ink[scheme], scheme)

    return [
      h('clipPath', { id: 'sky' }, [h('rect', { height: horizon.y, width })]),
      h('clipPath', { id: 'land' }, [h('rect', { height: height - horizon.y, width, y: horizon.y })]),
      h('circle', {
        'clip-path' : 'url(#sky)',
        cx          : sun.x,
        cy          : cy,
        fill        : this.#tokens.resolve(gold, scheme),
        r           : sun.r
      }),
      h('circle', {
        'clip-path'    : 'url(#land)',
        cx             : sun.x,
        cy             : cy,
        fill           : inked,
        'fill-opacity' : below[scheme],
        r              : sun.r
      }),
      h('path', {
        d                : `M${sun.x - half} ${horizon.y}H${sun.x + half}`,
        stroke           : inked,
        'stroke-opacity' : line.opacity,
        'stroke-width'   : horizon.stroke
      })
    ]
  }
}

/**
 * Names the file a card's form in `scheme` is served from, beneath the site's
 * root.
 */
export function cardAddress({ word }: StartCard, scheme: Scheme): string {
  return `/readme/${word.toLowerCase()}-${scheme}.svg`
}

/**
 * Writes the address on the site of the page `card` opens.
 */
export function pageAddress({ page }: StartCard): string {
  return `${manifest.homepage}/${page.replace(/(index)?\.md$/, '')}`
}
