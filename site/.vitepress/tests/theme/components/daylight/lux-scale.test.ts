/** @vitest-environment happy-dom */
import { fireEvent, getAllByRole, getByRole } from '@testing-library/dom'
import { expect, vi }                         from 'vitest'
import { h, nextTick }                        from 'vue'

import { LuxScale } from '../../../../theme/components/daylight/lux-scale.tsx'
import { data }     from '../../../common/data/daylight.ts'
import { test }     from '../../../common/mount.ts'

vi.mock('../../../../lib/daylight/daylight.data.ts', () => import('../../../common/data/daylight.ts'))

const { decades, opening } = data.luxScale

function chosen(host: HTMLElement): string | null {
  return host.querySelector('.layer.shown .lux-scale-range')!.textContent
}

test('sets a tile per decade, shaded with its ink and naming the minutes in it', ({ mount }) => {
  const tiles = getAllByRole(mount(LuxScale), 'tab')

  expect(tiles.map((tile) => tile.getAttribute('aria-label'))).toEqual(decades.map(({ label }) => label))
  expect(tiles[0]!.querySelector('b')!.textContent).toBe(String(decades[0]!.minutes))
  expect(tiles.map(({ style }) => [style.background, style.color]))
    .toEqual(decades.map(({ fill, ink }) => [fill, ink]))
})

test('opens on the decade of the sample day’s noon', ({ mount }) => {
  expect(chosen(mount(LuxScale))).toBe(decades[opening]!.range)
})

test('moves the panel to the tile a reader chooses', async ({ mount }) => {
  const host = mount(LuxScale)

  fireEvent.click(getAllByRole(host, 'tab')[0]!)
  await nextTick()

  expect(chosen(host)).toBe(decades[0]!.range)
  expect(getByRole(host, 'tabpanel').getAttribute('aria-labelledby')).toBe(getAllByRole(host, 'tab')[0]!.id)
})

test('lists the decade’s everyday light, the clear sky, and the day in the panel', ({ mount }) => {
  const text                        = mount(LuxScale).querySelector('.layer.shown')!.textContent
  const { clearSky, day, everyday } = decades[opening]!

  expect(text).toContain(clearSky)
  expect(text).toContain(day)
  expect(text).toContain(everyday.map(({ lux, name }) => `${name} at ${lux}`).join(', '))
})

test('holds the section’s words above the tiles', ({ mount }) => {
  const host = mount(LuxScale, {}, () => h('p', 'The words'))

  expect(host.querySelector('.lux-scale-words')!.textContent).toBe('The words')
})
