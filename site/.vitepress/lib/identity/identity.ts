import { readFile }      from 'node:fs/promises'
import { createRequire } from 'node:module'

import { parse, wcagContrast } from 'culori'
import { parseSync }           from 'oxc-parser'

import manifest                            from '../../../../package.json' with { type: 'json' }
import COLORS                              from '../../theme/styles/colors.json' with { type: 'json' }
import { CONSTRUCTION, type Construction } from '../logo/construction.ts'
import * as logo                           from '../logo/logo.ts'
import { SCHEMES, type Scheme, Tokens }    from '../theme/tokens.ts'

/**
 * The span one axis of a variable face runs, as its Fontsource package's
 * `metadata.json` gives it.
 */
interface Axis {
  default : number
  max     : number
  min     : number
}

/**
 * Everything the identity page draws, read from the file declaring each part.
 */
export interface Identity {
  colors  : Swatch[]
  faces   : LoadedFace[]
  grounds : Record<Scheme, Pick<Swatch, 'name' | 'token'>>
  lines   : Line[]
  logo    : { construction: Construction, svgs: Record<logo.Asset, Record<Scheme, string>> }
  tagline : string
}

/**
 * A line of the site's words, the face it is set in, left out for a line only
 * the metadata carries, and where it appears.
 */
interface Line {
  face? : string
  name  : string
  text  : string
  where : string
}

/**
 * A face in the role the theme gives it, with each axis its imported
 * stylesheet loads.
 */
interface LoadedFace {
  axes   : Readonly<Record<string, Axis>>
  family : string
  italic : boolean
  role   : string
}

type Meanings = Readonly<Record<string, Pick<Swatch, 'meaning' | 'name'>>>

/**
 * The fields of a Fontsource package's `metadata.json` the faces read.
 */
interface Metadata {
  family   : string
  variable : Readonly<Record<string, Record<keyof Axis, string>>>
}

/**
 * A color of the palette, beside its contrast against the ground of each
 * scheme and the use that contrast admits there.
 */
interface Swatch {
  contrast : Record<Scheme, number>
  hex      : string
  meaning  : string
  name     : string
  token    : string
  use      : Record<Scheme, Use>
}

type Use = (typeof USES)[number]

/**
 * Matches the stylesheet a theme import takes from a Fontsource variable
 * package, capturing the package and the axis its file name opens on.
 */
const FONTSOURCE = /^(@fontsource-variable\/[\w-]+)\/(\w+)(-italic)?\.css$/
/**
 * The ways a color shows on a ground, from the one needing the least contrast.
 */
const USES = ['fill', 'mark', 'text'] as const
/**
 * The least contrast WCAG 2.2 sets for a graphical object under Success
 * Criterion 1.4.11 and for body text under 1.4.3.
 */
const WCAG = { mark: 3, text: 4.5 } as const satisfies Record<Exclude<Use, 'fill'>, number>

/**
 * Picks the use a color admits at `contrast` against its ground: text, a mark,
 * or a fill beneath an ink edge.
 */
function useAt(contrast: number): Use {
  return contrast >= WCAG.text ? 'text' : contrast >= WCAG.mark ? 'mark' : 'fill'
}

/**
 * Lists the palette in the order `declared` names it, each color beside its
 * contrast against `--color-ground` in either scheme.
 *
 * The palette is every `--luxout-` color holding one value in both schemes, and
 * the call fails where `declared` and the tokens disagree on its members.
 */
export function colorsOf(tokens: Tokens, declared: Meanings = COLORS): Swatch[] {
  const palette = tokens.properties('light').filter((property) =>
       property.startsWith('--luxout-')
    && parse(tokens.resolve(property, 'light')) !== undefined
    && tokens.color(property, 'light') === tokens.color(property, 'dark')
  )
  const stray = new Set(Object.keys(declared)).symmetricDifference(new Set(palette))

  if (stray.size) throw new Error(`colors.json and the tokens disagree on ${[...stray].join(', ')}`)

  return Object.entries(declared).map(([token, { meaning, name }]) => {
    const hex      = tokens.color(token, 'light')
    const contrast = Object.fromEntries(SCHEMES.map((scheme) =>
      [scheme, wcagContrast(hex, tokens.color('--color-ground', scheme))]
    )) as Record<Scheme, number>

    return {
      contrast : contrast,
      hex      : hex,
      meaning  : meaning,
      name     : name,
      token    : token,
      use      : { dark: useAt(contrast.dark), light: useAt(contrast.light) }
    }
  })
}

/**
 * Lists the face each `--font-` token names first in its stack, reading the
 * face's axes from its Fontsource package's `metadata.json`.
 *
 * The packages are those whose stylesheets the theme module imports, and a face
 * with no such package fails the call.
 *
 * Fontsource writes every axis file with the weight axis beside the one its
 * name opens on, so `opsz.css` loads the optical-size and weight axes.
 *
 * Args:
 *   load   : Loads a package's file from where the site resolves its imports.
 *   theme  : The source of the theme module.
 *   tokens : The theme's tokens.
 */
export function facesOf(
  load   : (specifier: string) => unknown,
  theme  : string,
  tokens : Tokens
): LoadedFace[] {
  const imports = parseSync('index.ts', theme).module.staticImports
    .map(({ moduleRequest }) => FONTSOURCE.exec(moduleRequest.value))
    .filter((match) => match !== null)
  const loaded  = imports.map(([, pack, axis, italic]) => ({
    axis     : axis!,
    italic   : italic !== undefined,
    metadata : load(`${pack}/metadata.json`) as Metadata
  }))

  return tokens.properties('light')
    .filter((property) => property.startsWith('--font-') && property !== '--font-*')
    .map((property) => {
      const stacked = tokens.resolve(property, 'light').split(',')[0]!.trim().replaceAll("'", '')
      const files   = loaded.filter(({ metadata }) => `${metadata.family} Variable` === stacked)
      const [first] = files

      if (first === undefined) throw new Error(`The theme imports no Fontsource package for ${stacked}`)

      const { family, variable } = first.metadata
      const named                = new Set(['wght', ...files.map(({ axis }) => axis)])
      const tags                 = named.intersection(new Set(Object.keys(variable)))

      return {
        family : family,
        italic : files.some(({ italic }) => italic),
        role   : property.slice('--font-'.length),
        axes   : Object.fromEntries([...tags].sort().map((tag) => [tag, {
          default : Number(variable[tag]!.default),
          max     : Number(variable[tag]!.max),
          min     : Number(variable[tag]!.min)
        }]))
      }
    })
}

/**
 * Reads the identity from the site whose `.vitepress` directory is `root`:
 *
 * - The palette and the faces, from the theme's tokens and theme module
 * - The palette color each scheme's `--color-ground` holds
 * - The logo's construction and the forms of it the site serves
 * - The tagline opening the front page, in the base face's italic, and the
 *   byline, the package's own description, in no face, since only the
 *   metadata carries it
 */
export async function readIdentity(root: URL): Promise<Identity> {
  const [tokens, theme] = await Promise.all([
    Tokens.read(root),
    readFile(new URL('theme/index.ts', root), 'utf8')
  ])
  const svgs = Object.fromEntries(await Promise.all(logo.ASSETS.map(async (asset) => [
    asset,
    Object.fromEntries(await Promise.all(SCHEMES.map(async (scheme) => [
      scheme,
      await readFile(new URL(`../public${logo.addressOf(asset, scheme)}`, root), 'utf8')
    ])))
  ]))) as Identity['logo']['svgs']

  const colors  = colorsOf(tokens)
  const faces   = facesOf(createRequire(root), theme, tokens)
  const base    = faces.find(({ role }) => role === 'base')!.family
  const tagline = logo.readTagline(root)

  return {
    colors  : colors,
    faces   : faces,
    grounds : Object.fromEntries(SCHEMES.map((scheme) => {
      const { name, token } = colors.find(({ hex }) => hex === tokens.color('--color-ground', scheme))!

      return [scheme, { name, token }]
    })) as Identity['grounds'],
    lines   : [
      { face: `${base} italic`, name: 'Tagline', text: tagline, where: 'the front page’s opening line' },
      {
        name  : 'Byline',
        text  : manifest.description,
        where : 'the package’s description and each page’s meta description and og:description tags'
      }
    ],
    logo    : { construction: CONSTRUCTION, svgs },
    tagline : tagline
  }
}
