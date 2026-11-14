import { readFile }      from 'node:fs/promises'
import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

import manifest                            from '../../../../../package.json' with { type: 'json' }
import COLORS                              from '../../../theme/styles/colors.json' with { type: 'json' }
import { colorsOf, facesOf, readIdentity } from '../../../lib/identity/identity.ts'
import { CONSTRUCTION }                    from '../../../lib/logo/construction.ts'
import { ASSETS, addressOf }               from '../../../lib/logo/logo.ts'
import { SCHEMES, Tokens }                 from '../../../lib/theme/tokens.ts'

const root     = new URL('../../../', import.meta.url)
const identity = await readIdentity(root)
const load     = createRequire(root)
const tokens   = await Tokens.read(root)

describe('the palette', () => {
  it('lists every color colors.json names, in its order', () => {
    expect(identity.colors.map(({ name }) => name)).toEqual(Object.values(COLORS).map(({ name }) => name))
  })

  it.each([
    { dark: 10.58, hex: '#e8c840', light: 1.46, name: 'Eureka', use: { dark: 'text', light: 'fill' } },
    { dark: 3.29, hex: '#5069ad', light: 4.69, name: 'Toronto', use: { dark: 'mark', light: 'text' } },
    { dark: 7.79, hex: '#7db3e0', light: 1.98, name: 'Chambray', use: { dark: 'text', light: 'fill' } }
  ])(
    'reads $name at the contrast the identity records against each ground, and the use it admits',
    ({ dark, hex, light, name, use }) => {
      const color = identity.colors.find((candidate) => candidate.name === name)!

      expect(color.hex).toBe(hex)
      expect(color.contrast.light).toBeCloseTo(light, 2)
      expect(color.contrast.dark).toBeCloseTo(dark, 2)
      expect(color.use).toEqual(use)
    }
  )

  it.each([
    { hex: '#767676', use: 'text' },
    { hex: '#777777', use: 'mark' },
    { hex: '#949494', use: 'mark' },
    { hex: '#959595', use: 'fill' }
  ])('admits $use for $hex on a white ground, by the WCAG 2.2 ratio it holds there', ({ hex, use }) => {
    const sheet = Tokens.parse(`@theme { --color-ground: #fff; } :root { --luxout-a: ${hex}; }`)

    expect(colorsOf(sheet, { '--luxout-a': { meaning: '', name: 'A' } })[0]!.use.light).toBe(use)
  })

  it('fails where colors.json names a color whose value differs between the schemes', () => {
    const sheet = Tokens.parse(':root { --luxout-a: #fff; --luxout-b: #000; } .dark { --luxout-b: #111; }')
    const named = { '--luxout-a': { meaning: '', name: 'A' }, '--luxout-b': { meaning: '', name: 'B' } }

    expect(() => colorsOf(sheet, named)).toThrow('colors.json and the tokens disagree on --luxout-b')
  })

  it('fails where the tokens hold a palette color colors.json leaves unnamed', () => {
    const sheet = Tokens.parse(':root { --luxout-a: #fff; --luxout-b: #000; }')

    expect(() => colorsOf(sheet, { '--luxout-a': { meaning: '', name: 'A' } }))
      .toThrow('colors.json and the tokens disagree on --luxout-b')
  })
})

describe('the faces', () => {
  it('reads each face in its role, with the axes and the style its stylesheets load', () => {
    expect(identity.faces).toEqual([
      {
        axes   : { opsz: { default: 14, max: 60, min: 8 }, wght: { default: 400, max: 900, min: 200 } },
        family : 'Source Serif 4',
        italic : true,
        role   : 'base'
      },
      {
        axes   : { opsz: { default: 11, max: 96, min: 6 }, wght: { default: 400, max: 900, min: 400 } },
        family : 'Bodoni Moda',
        italic : true,
        role   : 'display'
      },
      {
        axes   : { wght: { default: 400, max: 800, min: 100 } },
        family : 'JetBrains Mono',
        italic : false,
        role   : 'mono'
      }
    ])
  })

  it('lists each face’s axes by tag', () => {
    expect(identity.faces.map(({ axes }) => Object.keys(axes)))
      .toEqual([['opsz', 'wght'], ['opsz', 'wght'], ['wght']])
  })

  it('reads the weight axis alone from a face’s weight stylesheet', () => {
    const theme = "import '@fontsource-variable/bodoni-moda/wght.css'"
    const sheet = Tokens.parse("@theme { --font-display: 'Bodoni Moda Variable', serif; }")

    const [face] = facesOf(load, theme, sheet)

    expect(face!.axes).toEqual({ wght: { default: 400, max: 900, min: 400 } })
  })

  it('fails on a face the theme imports no Fontsource package for', () => {
    expect(() => facesOf(load, '', tokens))
      .toThrow('The theme imports no Fontsource package for Source Serif 4 Variable')
  })
})

describe('the logo, the tagline, and the byline', () => {
  it.for(ASSETS.flatMap((asset) => SCHEMES.map((scheme) => ({ asset, scheme }))))(
    'reads the $scheme $asset the site serves',
    async ({ asset, scheme }, { expect }) => {
      expect(identity.logo.svgs[asset][scheme])
        .toBe(await readFile(new URL(`../public${addressOf(asset, scheme)}`, root), 'utf8'))
    }
  )

  it('carries the construction the logo is drawn from', () => {
    expect(identity.logo.construction).toBe(CONSTRUCTION)
  })

  it('reads the tagline opening the front page and the description the package declares', () => {
    expect([identity.tagline, identity.byline])
      .toEqual(['An outdoor light sensor for Apple Home.', manifest.description])
  })
})
