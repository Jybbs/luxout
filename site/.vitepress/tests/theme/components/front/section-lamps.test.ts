/** @vitest-environment happy-dom */
import { fireEvent, getAllByRole } from '@testing-library/dom'
import { expect, vi }              from 'vitest'
import { nextTick }                from 'vue'

import { SECTIONS }     from '../../../../lib/config/sections.ts'
import { PAUSES }       from '../../../../lib/motion/timing.ts'
import { SectionLamps } from '../../../../theme/components/front/section-lamps.tsx'
import { test }         from '../../../common/mount.ts'

function lit(host: HTMLElement): number[] {
  return [...host.querySelectorAll('.section-lamps-lamp')].flatMap((lamp, index) =>
    lamp.hasAttribute('data-lit') ? [index] : []
  )
}

test('links one lamp per section in reading order, lighting the first', ({ mount }) => {
  const host = mount(SectionLamps)

  expect(getAllByRole(host, 'link').slice(0, SECTIONS.length).map((link) => link.getAttribute('href')))
    .toEqual(SECTIONS.map(({ slug }) => `/${slug}/`))
  expect(lit(host)).toEqual([0])
})

test('describes each lamp by the plate layer naming what its section holds', ({ mount }) => {
  const host  = mount(SectionLamps)
  const lamps = host.querySelectorAll('.section-lamps-lamp a')

  expect([...lamps].map((lamp) => host.querySelector(`[id="${lamp.getAttribute('aria-describedby')}"]`)
    ?.textContent)).toEqual(SECTIONS.map(({ holds, label }, index) =>
    `${String(index + 1).padStart(2, '0')} · ${label}${holds}Open ${label}`
  ))
})

test('lights the lamp the focus reaches at once', async ({ mount }) => {
  const host = mount(SectionLamps)

  fireEvent.focus(host.querySelectorAll('.section-lamps-lamp a')[2]!)
  await nextTick()

  expect(lit(host)).toEqual([2])
})

test('lights the lamp a mouse rests on through the dwell pause, and no touch', async ({ mount }) => {
  const host  = mount(SectionLamps)
  const lamps = host.querySelectorAll('.section-lamps-lamp a')

  fireEvent.pointerEnter(lamps[1]!, { pointerType: 'touch' })
  fireEvent.pointerEnter(lamps[3]!, { pointerType: 'mouse' })
  vi.advanceTimersByTime(PAUSES.dwell - 1)
  await nextTick()
  expect(lit(host)).toEqual([0])

  vi.advanceTimersByTime(1)
  await nextTick()
  expect(lit(host)).toEqual([3])
})

test('keeps the reached lamp lit when the mouse leaves before the dwell pause passes', async ({ mount }) => {
  const host  = mount(SectionLamps)
  const lamps = host.querySelectorAll('.section-lamps-lamp a')

  fireEvent.pointerEnter(lamps[1]!, { pointerType: 'mouse' })
  fireEvent.pointerLeave(lamps[1]!)
  vi.advanceTimersByTime(PAUSES.dwell)
  await nextTick()

  expect(lit(host)).toEqual([0])
})
