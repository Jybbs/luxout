import { fileURLToPath } from 'node:url'

import { type VNode, h } from 'vue'

import manifest                 from '../../../../package.json' with { type: 'json' }
import * as faces               from '../cards/faces.ts'
import { shadeAt }              from '../cards/sky.ts'
import { pageTitle }            from '../config/pages.ts'
import { SampleDay, crossings } from '../daylight/sample-day.ts'
import { SUNSET }               from '../daylight/sun-curve.ts'
import { type Scheme, Tokens }  from '../theme/tokens.ts'

/**
 * One card of the README's Where to Start row, the page it opens beneath the
 * site's root, the word it carries, and the minute of the sample day whose sky
 * it shows.
 */
interface StartCard {
  minute : (day: SampleDay) => number
  page   : string
  word   : string
}

/**
 * The card's parts in its own units, which the README shows at half size.
 */
const LAYOUT = {
  height  : 232,
  horizon : 158,
  name    : { size: 22, y: 204 },
  rx      : 20,
  width   : 520,
  word    : { size: 64, y: 106 }
}
export const START_CARDS: readonly StartCard[] = [
  { minute: () => SampleDay.NOON, page: 'estimate/index.md', word: 'Understand' },
  { minute: ({ altitudes }) => crossings(altitudes, -6)[1], page: 'troubleshooting/index.md', word: 'Check' },
  { minute: ({ altitudes }) => crossings(altitudes, SUNSET)[0], page: 'install/installing.md', word: 'Run' }
]
const SVG                = 'http://www.w3.org/2000/svg'
const WORD : faces.Voice = { axes: { opsz: 12, wght: 600 }, face: 'display' }

/**
 * Draws the README's start cards, each the sky at its page's minute of the
 * sample day above a horizon, its word in the ink that reads best on that sky
 * and its page's name on the ground beneath.
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
    const { height, horizon, name, rx, width, word } = LAYOUT

    const color = (property: string) => this.#tokens.resolve(property, scheme)
    const sky   = shadeAt(this.#day.readings[card.minute(this.#day)]!)
    const title = this.title(card)
    const say   = (text: string, voice: faces.Voice, fill: string, at: Pick<faces.Saying, 'size' | 'y'>) =>
      this.#faces.say(text, voice, { ...at, anchor: 'middle', fill, x: width / 2 })

    return h('svg', {
      'aria-label' : `${card.word}: ${title}`,
      height       : height / 2,
      role         : 'img',
      viewBox      : `0 0 ${width} ${height}`,
      width        : width / 2,
      xmlns        : SVG
    }, [
      h('clipPath', { id: 'card' }, [h('rect', { height, rx, width })]),
      h('g', { 'clip-path': 'url(#card)' }, [
        h('rect', { fill: color('--vp-c-bg'), height, width }),
        h('rect', { fill: sky.fill, height: horizon, width })
      ]),
      h('path', {
        d                : `M0 ${horizon}H${width}`,
        stroke           : color('--vp-c-text-1'),
        'stroke-opacity' : 0.55,
        'stroke-width'   : 2
      }),
      h('rect', {
        fill           : 'none',
        height         : height - 2,
        rx             : rx,
        stroke         : color('--vp-c-divider'),
        'stroke-width' : 2,
        width          : width - 2,
        x              : 1,
        y              : 1
      }),
      say(card.word, WORD, sky.ink, word),
      say(title, faces.MONO, color('--vp-c-text-2'), name)
    ])
  }

  /**
   * Reads the first heading of the page `card` opens.
   */
  title(card: StartCard): string {
    return pageTitle(fileURLToPath(new URL(`../${card.page}`, this.#root)))
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
