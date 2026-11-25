import { readFile }      from 'node:fs/promises'
import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

import manifest              from '../../../../package.json' with { type: 'json' }
import COLORS                from '../../../../site/.vitepress/theme/styles/colors.json' with { type: 'json' }
import * as identity         from '../../../../site/.vitepress/lib/identity/identity.ts'
import { CONSTRUCTION }      from '../../../../site/.vitepress/lib/logo/construction.ts'
import { ASSETS, addressOf } from '../../../../site/.vitepress/lib/logo/logo.ts'
import { SCHEMES, Tokens }   from '../../../../site/.vitepress/lib/theme/tokens.ts'
import { vitepress }         from '../../common/paths.ts'

const site   = await identity.readIdentity(vitepress)
const load   = createRequire(vitepress)
const tokens = await Tokens.read(vitepress)

describe('the palette', () => {
  it.for([
    { name: 'Cararra', scheme: 'light' },
    { name: 'Near Black', scheme: 'dark' }
  ] as const)(
    'names $name as the $scheme ground the contrast is read against',
    ({ name, scheme }, { expect }) => {
      const ground = site.grounds[scheme]

      expect([ground.name, tokens.color(ground.token, 'light')])
        .toEqual([name, tokens.color('--color-ground', scheme)])
    }
  )

  it('lists every color colors.json names, in its order', () => {
    expect(site.colors.map(({ name }) => name)).toEqual(Object.values(COLORS).map(({ name }) => name))
  })

  it.each([
    { dark: 10.58, hex: '#e8c840', light: 1.46, name: 'Eureka', use: { dark: 'text', light: 'fill' } },
    { dark: 3.29, hex: '#5069ad', light: 4.69, name: 'Toronto', use: { dark: 'mark', light: 'text' } },
    { dark: 7.79, hex: '#7db3e0', light: 1.98, name: 'Chambray', use: { dark: 'text', light: 'fill' } }
  ])(
    'reads $name at the contrast the identity records against each ground, and the use it admits',
    ({ dark, hex, light, name, use }) => {
      const color = site.colors.find((candidate) => candidate.name === name)!

      expect(color.hex).toBe(hex)
      expect([color.contrast.light, color.contrast.dark]).toStrictEqual([light, dark].map((v) =>
        expect.closeTo(v, 2)
      ))
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

    expect(identity.colorsOf(sheet, { '--luxout-a': { meaning: '', name: 'A' } })[0]!.use.light).toBe(use)
  })

  it('fails where colors.json names a color whose value differs between the schemes', () => {
    const sheet = Tokens.parse(':root { --luxout-a: #fff; --luxout-b: #000; } .dark { --luxout-b: #111; }')
    const named = { '--luxout-a': { meaning: '', name: 'A' }, '--luxout-b': { meaning: '', name: 'B' } }

    expect(() => identity.colorsOf(sheet, named)).toThrow('colors.json and the tokens disagree on --luxout-b')
  })

  it('fails where the tokens hold a palette color colors.json leaves unnamed', () => {
    const sheet = Tokens.parse(':root { --luxout-a: #fff; --luxout-b: #000; }')

    expect(() => identity.colorsOf(sheet, { '--luxout-a': { meaning: '', name: 'A' } }))
      .toThrow('colors.json and the tokens disagree on --luxout-b')
  })
})

describe('the faces', () => {
  it('reads each face in its role, with the axes and the style its stylesheets load', () => {
    expect(site.faces).toEqual([
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
    expect(site.faces.map(({ axes }) => Object.keys(axes)))
      .toEqual([['opsz', 'wght'], ['opsz', 'wght'], ['wght']])
  })

  it('reads the weight axis alone from a face’s weight stylesheet', () => {
    const theme = "import '@fontsource-variable/bodoni-moda/wght.css'"
    const sheet = Tokens.parse("@theme { --font-display: 'Bodoni Moda Variable', serif; }")

    const [face] = identity.facesOf(load, theme, sheet)

    expect(face!.axes).toEqual({ wght: { default: 400, max: 900, min: 400 } })
  })

  it('fails on a face the theme imports no Fontsource package for', () => {
    expect(() => identity.facesOf(load, '', tokens))
      .toThrow('The theme imports no Fontsource package for Source Serif 4 Variable')
  })
})

describe('the logo, the tagline, and the byline', () => {
  it.for(ASSETS.flatMap((asset) => SCHEMES.map((scheme) => ({ asset, scheme }))))(
    'reads the $scheme $asset the site serves',
    async ({ asset, scheme }, { expect }) => {
      expect(site.logo.svgs[asset][scheme])
        .toBe(await readFile(new URL(`../public${addressOf(asset, scheme)}`, vitepress), 'utf8'))
    }
  )

  it('carries the construction the logo is drawn from', () => {
    expect(site.logo.construction).toBe(CONSTRUCTION)
  })

  it('reads the tagline opening the front page and the description the package declares', () => {
    expect(site.lines.map(({ face, text }) => [text, face])).toEqual([
      ['An outdoor light sensor for Apple Home.', 'Source Serif 4 italic'],
      [manifest.description, undefined]
    ])
  })
})
