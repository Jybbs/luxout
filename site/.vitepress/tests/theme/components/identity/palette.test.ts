/** @vitest-environment happy-dom */
import { fireEvent, getAllByRole } from '@testing-library/dom'
import { expect, vi }               from 'vitest'
import { nextTick }                 from 'vue'

import { PaletteBands } from '../../../../theme/components/identity/palette.tsx'
import { data }         from '../../../common/data/identity.ts'
import { test }         from '../../../common/mount.ts'

vi.mock('../../../../lib/identity/identity.data.ts', () => import('../../../common/data/identity.ts'))

const { colors } = data

function shown(host: HTMLElement): string {
  return host.querySelector('.layer.shown')!.textContent
}

test('names a band for each color, in the order colors.json sets them out', ({ mount }) => {
  const host = mount(PaletteBands)

  expect(getAllByRole(host, 'tab').map((tab) => tab.getAttribute('aria-label')))
    .toEqual(colors.map(({ name }) => name))
})

test.for(colors.map((swatch, index) => ({ ...swatch, index })))(
  'reads out $name with its hex, token, meaning, and its use on each ground',
  async ({ contrast, hex, index, meaning, name, token, use }, { mount }) => {
    const host = mount(PaletteBands)

    fireEvent.click(getAllByRole(host, 'tab')[index]!)
    await nextTick()

    expect(shown(host)).toContain(`${name}${hex} · ${token}${meaning}`)
    expect(shown(host)).toContain(`On Cararra${use.light} ${contrast.light.toFixed(2)}`)
    expect(shown(host)).toContain(`On Near Black${use.dark} ${contrast.dark.toFixed(2)}`)
  }
)

test.for([
  { drawn: 'SPAN Aa', use: 'text' },
  { drawn: 'svg ', use: 'mark' },
  { drawn: 'SPAN ', use: 'fill' }
] as const)(
  'draws a color as $use on a ground where its contrast admits that use',
  async ({ drawn, use }, { mount }) => {
    const index = colors.findIndex((swatch) => swatch.use.light === use)
    const host  = mount(PaletteBands)

    fireEvent.click(getAllByRole(host, 'tab')[index]!)
    await nextTick()

    const glyph = host.querySelector('.layer.shown .row-span-2')!.firstElementChild!

    expect(`${glyph.tagName} ${glyph.textContent}`).toBe(drawn)
    expect(glyph.outerHTML).toContain(`var(${colors[index]!.token})`)
  }
)

test('names each band in the ink of whichever ground has more contrast on it', ({ mount }) => {
  const inks = getAllByRole(mount(PaletteBands), 'tab').map((tab) => tab.style.color)

  expect(inks).toEqual(colors.map(({ contrast }) =>
    `var(${data.grounds[contrast.dark >= contrast.light ? 'dark' : 'light'].token})`))
  expect(new Set(inks).size).toBe(2)
})

test('sets each cell on its own ground and ink, edging a fill in that ink', async ({ mount }) => {
  const index = colors.findIndex((swatch) => swatch.use.light === 'fill')
  const host  = mount(PaletteBands)

  fireEvent.click(getAllByRole(host, 'tab')[index]!)
  await nextTick()

  const { ink } = data.logo.construction
  const cells   = [...host.querySelectorAll('.layer.shown .uppercase')]
    .filter(({ textContent }) => textContent.startsWith('On '))
    .map(({ parentElement }) => parentElement!)

  expect(cells.map(({ style }) => [style.background, style.color])).toEqual([
    [`var(${data.grounds.light.token})`, `var(${ink.light})`],
    [`var(${data.grounds.dark.token})`, `var(${ink.dark})`]
  ])
  expect(cells[0]!.querySelector<HTMLElement>('.border')!.style.borderColor).toBe(`var(${ink.light})`)
})

test('fills each band with its color, the picked band naming it beside its hex', ({ mount }) => {
  const tabs = getAllByRole(mount(PaletteBands), 'tab')

  expect(tabs.map(({ style }) => style.background)).toEqual(colors.map(({ token }) => `var(${token})`))
  expect(tabs[0]!.textContent).toBe(`${colors[0]!.name}${colors[0]!.hex}`)
})
