import { describe, expect, it } from 'vitest'
import { renderToString }       from 'vue/server-renderer'

import { ASSETS, Logo, addressOf } from '../../../lib/logo/logo.ts'
import { SCHEMES }                 from '../../../lib/theme/tokens.ts'

const logo  = await Logo.read(new URL('../../../', import.meta.url))
const forms = ASSETS.flatMap((asset) => SCHEMES.map((scheme) => ({ asset, scheme })))

describe('the tracked logo files', () => {
  it.for(forms)(
    'hold the $scheme $asset as the construction draws it',
    async ({ asset, scheme }, { expect }) => {
      await expect(`${await renderToString(logo[asset](scheme))}\n`)
        .toMatchFileSnapshot(`../../../../public${addressOf(asset, scheme)}`)
    }
  )
})

it('places the title in a larger drawing, its height following the span its ink covers', () => {
  const narrow = logo.titleAcross(60, 360, 'dark', 164).props!
  const wide   = logo.titleAcross(60, 660, 'dark', 164).props!

  expect(wide.height / narrow.height).toBeCloseTo(2, 1)
  expect(wide.x).toBeLessThan(60)
  expect(wide.y).toBeLessThan(164)
})
