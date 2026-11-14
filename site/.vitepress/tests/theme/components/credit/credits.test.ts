/** @vitest-environment happy-dom */
import { expect, vi } from 'vitest'
import { h }          from 'vue'

import { creditRows } from '../../../../lib/credit/credit.ts'
import { Credits }    from '../../../../theme/components/credit/credits.tsx'
import { data }       from '../../../common/data/credit.ts'
import { test }       from '../../../common/mount.ts'

vi.mock('../../../../lib/credit/credit.data.ts', () => import('../../../common/data/credit.ts'))

test('sets each row of the credit beside its label, linking each value with an address', ({ mount }) => {
  const host  = mount(Credits)
  const rows  = creditRows()
  const texts = (selector: string) =>
    [...host.querySelectorAll(selector)].map(({ textContent }) => textContent)

  expect(texts('dt')).toEqual(rows.map(({ label }) => label))
  expect(texts('dd')).toEqual(rows.map(({ code, detail, value }) =>
    detail?.replaceAll('`', '') ?? (code ? `${code} ${value}` : value)
  ))
  expect([...host.querySelectorAll('dd a')].map((link) => link.getAttribute('href')))
    .toEqual(rows.flatMap(({ href }) => href ? [href] : []))
})

test('draws the seal in the theme’s colors, hidden from a screen reader beside its rows', ({ mount }) => {
  const seal = mount(Credits).querySelector('.credits-seal')!

  expect(seal.getAttribute('aria-hidden')).toBe('true')
  expect(seal.querySelectorAll('path[transform]')).toHaveLength(data.rim.length)
  expect(new Set([...seal.querySelectorAll('[fill], [stroke]')].flatMap((mark) =>
    ['fill', 'stroke'].map((name) => mark.getAttribute(name)).filter((paint) => paint && paint !== 'none')
  ))).toEqual(new Set(['accent', 'forecast', 'ink', 'rule', 'sky'].map((color) => `var(--color-${color})`)))
})

test('clips the sun of each seal on a page by a path of its own', ({ mount }) => {
  const clips = [...mount(() => [h(Credits), h(Credits)]).querySelectorAll('clipPath')].map(({ id }) => id)

  expect(new Set(clips).size).toBe(2)
})

test('holds the section’s words beside the seal', ({ mount }) => {
  const host = mount(Credits, {}, () => h('p', 'The forecast'))

  expect(host.querySelector('.credits-words p')!.textContent).toBe('The forecast')
})

test('sets the plugin’s change as the site’s sentence, its field and its step as code', ({ mount }) => {
  const changed = [...mount(Credits).querySelectorAll('dd')].at(-1)!

  expect([...changed.querySelectorAll('code')].map(({ textContent }) => textContent))
    .toEqual(['shortwave_radiation_instant', '15 min'])
})
