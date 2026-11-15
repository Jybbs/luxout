/** @vitest-environment happy-dom */
import { fireEvent, getAllByRole, getByRole } from '@testing-library/dom'
import { expect, vi }                        from 'vitest'
import { nextTick }                          from 'vue'

import { LogoWipe }      from '../../../../theme/components/identity/logo.tsx'
import { keyOn, test }   from '../../../common/mount.ts'

vi.mock('../../../../lib/identity/identity.data.ts', () => import('../../../common/data/identity.ts'))

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
