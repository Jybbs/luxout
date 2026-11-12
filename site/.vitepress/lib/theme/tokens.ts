import { readFile } from 'node:fs/promises'

import { parse } from 'postcss'

export type Scheme = (typeof SCHEMES)[number]

export const SCHEMES = ['dark', 'light'] as const
/**
 * Lists the rules whose declarations reach each scheme, the later rule winning,
 * since VitePress sets the `dark` class on the root element in the dark scheme.
 */
const SELECTORS = { dark: [':root', '.dark'], light: [':root'] } as const satisfies Record<Scheme, string[]>

/**
 * The custom properties the theme's tokens stylesheet declares, read as each
 * color scheme resolves them.
 */
export class Tokens {
  readonly #schemes: Record<Scheme, Map<string, string>>

  static parse(css: string): Tokens {
    const rules   = parse(css).nodes.filter((node) => node.type === 'rule')
    const declare = (selector: string) => rules
      .filter((rule) => rule.selector === selector)
      .flatMap((rule) => rule.nodes.filter((node) => node.type === 'decl'))
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
   * Reads `property` as `scheme` computes it, following each `var()` that names
   * another property to the value it holds.
   */
  resolve(property: string, scheme: Scheme): string {
    const value = this.#schemes[scheme].get(property)

    if (value === undefined) throw new Error(`The tokens declare no ${property} in the ${scheme} scheme`)

    const reference = /^var\((--[\w-]+)\)$/.exec(value)?.[1]

    return reference === undefined ? value : this.resolve(reference, scheme)
  }
}
