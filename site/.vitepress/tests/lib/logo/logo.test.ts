import { describe, expect, it } from 'vitest'
import type { VNode }           from 'vue'
import { renderToString }       from 'vue/server-renderer'

import { ASSETS, FORMS, Logo, addressOf, groundedAddressOf } from '../../../lib/logo/logo.ts'
import { SCHEMES, Tokens }                                     from '../../../lib/theme/tokens.ts'

const root     = new URL('../../../', import.meta.url)
const forms    = ASSETS.flatMap((asset) => SCHEMES.map((scheme) => ({ asset, scheme })))
const grounded = FORMS.flatMap((form) => SCHEMES.map((scheme) => ({ form, scheme })))
const logo     = await Logo.read(root)
const tokens   = await Tokens.read(root)

describe('the tracked logo files', () => {
  it.for(forms)(
    'hold the $scheme $asset as the construction draws it',
    async ({ asset, scheme }, { expect }) => {
      await expect(`${await renderToString(logo[asset](scheme))}\n`)
        .toMatchFileSnapshot(`../../../../public${addressOf(asset, scheme)}`)
    }
  )

  it.for(grounded)(
    'hold the $scheme $form drawn on its ground',
    async ({ form, scheme }, { expect }) => {
      await expect(`${await renderToString(logo.grounded(form, scheme))}\n`)
        .toMatchFileSnapshot(`../../../../public${groundedAddressOf(form, scheme)}`)
    }
  )
})

it.for(grounded)('fills the $scheme $form’s whole box with its ground', ({ form, scheme }) => {
  const drawing                 = logo.grounded(form, scheme)
  const [ground]                = drawing.children as VNode[]
  const { x, y, width, height } = ground!.props!

  expect([ground!.type, ground!.props!.fill]).toEqual(['rect', tokens.color('--color-ground', scheme)])
  expect(`${x} ${y} ${width} ${height}`).toBe(drawing.props!.viewBox)
  expect((logo[form](scheme).children as VNode[])[0]!.type).toBe('defs')
})

it('places the title in a larger drawing, its height following the span its ink covers', () => {
  const narrow = logo.titleAcross(60, 360, 'dark', 164).props!
  const wide   = logo.titleAcross(60, 660, 'dark', 164).props!

  expect(wide.height / narrow.height).toBeCloseTo(2, 1)
  expect(wide.x).toBeLessThan(60)
  expect(wide.y).toBeLessThan(164)
})

it.each(SCHEMES)('inks the %s hero’s letters above the horizon in the page’s color', async (scheme) => {
  const hero = await renderToString(logo.hero(scheme))

  expect(hero).toContain('fill="currentColor"')
  expect(await renderToString(logo.title(scheme))).not.toContain('currentColor')
})

it.each(SCHEMES)('opens every id and reference in the %s hero on the scheme', async (scheme) => {
  const hero = await renderToString(logo.hero(scheme))
  const ids  = [...hero.matchAll(/id="([^"]+)"|url\(#([^)]+)\)/g)].map(([, id, url]) => id ?? url)

  expect(ids).not.toHaveLength(0)
  expect(ids.filter((id) => !id!.startsWith(`${scheme}-`))).toEqual([])
})

it('gives the title’s parts as shares of its width, the horizon below its top', () => {
  const { height, horizon, left, line, right, sun } = logo.shares

  expect(left).toBeLessThan(right)
  expect(right).toBeLessThan(1)
  expect(horizon).toBeLessThan(height)
  expect([line, sun].map((share) => share > 0 && share < left + sun)).toEqual([true, true])
})
