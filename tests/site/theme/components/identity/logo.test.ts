/** @vitest-environment happy-dom */
import { fireEvent, getAllByRole, getByRole } from '@testing-library/dom'
import { expect, vi }                        from 'vitest'
import { nextTick }                          from 'vue'

import { LogoWipe }    from '../../../../../site/.vitepress/theme/components/identity/logo.tsx'
import { data }        from '../../../common/data/identity.ts'
import { keyOn, test } from '../../../common/mount.ts'

vi.mock(
  '../../../../../site/.vitepress/lib/identity/identity.data.ts',
  () => import('../../../common/data/identity.ts')
)

test('draws the title and the mark at 16, 32, and 48 pixels on each ground', ({ mount }) => {
  const host = mount(LogoWipe)

  expect(getAllByRole(host, 'img').map((img) => img.getAttribute('alt'))).toEqual([
    'luxout, the title on Cararra', 'The mark at 16 pixels', 'The mark at 32 pixels',
    'The mark at 48 pixels', 'luxout, the title on Near Black', 'The mark at 16 pixels',
    'The mark at 32 pixels', 'The mark at 48 pixels'
  ])
})

test('lays the construction and its key over the title on the switch', async ({ mount }) => {
  const host   = mount(LogoWipe)
  const toggle = getByRole(host, 'button')
  const key    = host.querySelector('ul')!.parentElement!

  expect(key.inert).toBe(true)

  fireEvent.click(toggle)
  await nextTick()

  expect(toggle.getAttribute('aria-pressed')).toBe('true')
  expect(key.inert).toBe(false)
  expect(host.querySelectorAll('svg.opacity-100')).toHaveLength(2)
})

test.for([
  { inset: '0 0% 0 0', key: 'End' },
  { inset: '0 100% 0 0', key: 'Home' }
])('wipes Near Black to inset($inset) on $key', async ({ inset, key }, { mount }) => {
  const host = mount(LogoWipe)

  await keyOn(getByRole(host, 'slider'), key)
  await nextTick()

  expect(host.querySelector<HTMLElement>('[style*="clip-path"]')!.style.clipPath).toBe(`inset(${inset})`)
})

test('draws each ground’s own form of the title and the mark', ({ mount }) => {
  const { svgs } = data.logo
  const drawn    = getAllByRole(mount(LogoWipe), 'img')
    .map((img) => decodeURIComponent(img.getAttribute('src')!.replace('data:image/svg+xml,', '')))

  expect(drawn).toEqual((['light', 'dark'] as const).flatMap((scheme) => [
    svgs.title[scheme], ...Array(3).fill(svgs.mark[scheme])
  ]))
})

test(
  'marks the break and the glow at the multiples of the sun’s radius the construction sets',
  ({ mount }) => {
    const overlay      = mount(LogoWipe).querySelector('.relative > svg')!
    const sun          = overlay.querySelector('circle')!
    const [cx, r]      = ['cx', 'r'].map((name) => Number(sun.getAttribute(name)))
    const [, ...marks] = [...overlay.querySelectorAll('path')].map((path) => path.getAttribute('d')!)
    const reach        = (d: string) => Math.abs(Number(/^M(-?[\d.]+)/.exec(d)![1]) - cx!) / r!

    expect(marks.map(reach)).toEqual([
      expect.closeTo(data.logo.construction.horizon.gap, 2),
      expect.closeTo(data.logo.construction.horizon.gap, 2),
      expect.closeTo(data.logo.construction.glow.radius, 2)
    ])
  }
)

test('lays the horizon and the sun on the rule the title draws', ({ mount }) => {
  const title   = new DOMParser().parseFromString(data.logo.svgs.title.light, 'image/svg+xml')
  const rule    = [...title.querySelectorAll('rect')].at(-1)!
  const [y, h]  = ['y', 'height'].map((name) => Number(rule.getAttribute(name)))
  const overlay = mount(LogoWipe).querySelector('.relative > svg')!

  expect(Number(overlay.querySelector('circle')!.getAttribute('cy'))).toBe(-(y! + h! / 2))
})
