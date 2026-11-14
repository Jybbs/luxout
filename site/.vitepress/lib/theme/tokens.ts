import { readFile } from 'node:fs/promises'

import { formatHex, interpolate } from 'culori'
import { parse }                  from 'postcss'

export type Scheme = (typeof SCHEMES)[number]
type Space         = keyof typeof SPACES

/**
 * The media query a frame's stylesheet holds its dark scheme's rules under.
 */
export const DARK    = '(prefers-color-scheme: dark)'
/**
 * Matches a `color-mix()` of two colors, the first taking a share in percent.
 */
const MIX            = /^color-mix\(in (oklab|srgb), (.+) ([\d.]+)%, (.+)\)$/
export const SCHEMES = ['dark', 'light'] as const
/**
 * Lists the rules whose declarations reach each scheme, the later rule winning,
 * since VitePress sets the `dark` class on the root element in the dark scheme.
 */
const SELECTORS = {
  dark  : ['@theme', ':root', '.dark'],
  light : ['@theme', ':root']
} as const satisfies Record<Scheme, string[]>
/**
 * Names the culori mode each color space a `color-mix()` names mixes in.
 */
const SPACES = { oklab: 'oklab', srgb: 'rgb' } as const

/**
 * The custom properties the theme's tokens stylesheet declares, read as each
 * color scheme resolves them.
 */
export class Tokens {
  readonly #schemes: Record<Scheme, Map<string, string>>

  static parse(css: string): Tokens {
    const { nodes } = parse(css)
    const declare   = (selector: string) => nodes
      .flatMap((node) => node.type === 'rule' && node.selector === selector
                      || node.type === 'atrule' && `@${node.name}` === selector ? node.nodes ?? [] : [])
      .filter((node) => node.type === 'decl')
      .map(({ prop, value }): [string, string] => [prop, value])

    return new Tokens({
      dark  : new Map(SELECTORS.dark.flatMap(declare)),
      light : new Map(SELECTORS.light.flatMap(declare))
    })
  }

  /**
   * Reads the tokens stylesheet from beneath `root`, the site's `.vitepress`
   * directory.
   */
  static async read(root: URL): Promise<Tokens> {
    return Tokens.parse(await readFile(new URL('theme/styles/tokens.css', root), 'utf8'))
  }

  constructor(schemes: Record<Scheme, Map<string, string>>) {
    this.#schemes = schemes
  }

  /**
   * Reads the color `property` holds in `scheme` as a hex code, mixing each
   * `color-mix()` it holds in the space the call names.
   */
  color(property: string, scheme: Scheme): string {
    return this.#paint(this.resolve(property, scheme), scheme)
  }

  /**
   * Reads `value` as `scheme` computes it, following a value that is one `var()`
   * to the value it names and mixing a `color-mix()` found there into a hex code,
   * and returns any other value as written.
   */
  computed(value: string, scheme: Scheme): string {
    const followed = this.follow(value, scheme)

    return MIX.test(followed) ? this.#paint(followed, scheme) : followed
  }

  /**
   * Writes the stylesheet `css` as `scheme` applies it, the rules under its dark
   * media query kept in the dark scheme alone and each value written as
   * `computed` reads it.
   */
  flatten(css: string, scheme: Scheme): string {
    const root = parse(css)

    root.walkAtRules('media', (query) => {
      if (query.params !== DARK) return
      if (scheme === 'dark') query.replaceWith(query.nodes ?? [])
      else query.remove()
    })
    root.walkDecls((declaration) => {
      declaration.value = this.computed(declaration.value, scheme)
    })

    return root.toString()
  }

  /**
   * Reads `value` as `scheme` computes it where the whole value is one `var()`,
   * following it to the value the property it names holds, and returns any
   * other value as written.
   */
  follow(value: string, scheme: Scheme): string {
    const reference = /^var\((--[\w-]+)\)$/.exec(value)?.[1]

    return reference === undefined ? value : this.resolve(reference, scheme)
  }

  /**
   * Reads `property` as `scheme` computes it, following each `var()` that names
   * another property to the value it holds.
   */
  resolve(property: string, scheme: Scheme): string {
    const value = this.#schemes[scheme].get(property)

    if (value === undefined) throw new Error(`The tokens declare no ${property} in the ${scheme} scheme`)

    return this.follow(value, scheme)
  }

  #paint(value: string, scheme: Scheme): string {
    const color                         = this.follow(value, scheme)
    const [, space, ink, share, ground] = MIX.exec(color) ?? []

    if (space === undefined) return formatHex(color)!

    const mix = interpolate([this.#paint(ground!, scheme), this.#paint(ink!, scheme)], SPACES[space as Space])

    return formatHex(mix(Number(share) / 100))
  }
}
