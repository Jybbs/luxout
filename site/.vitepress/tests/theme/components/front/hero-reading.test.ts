/** @vitest-environment happy-dom */
import { fireEvent, getByRole }  from '@testing-library/dom'
import { afterEach, expect, vi } from 'vitest'
import { nextTick }              from 'vue'

import { useFrontFacts, useFrontMinute } from '../../../../lib/front/minute.ts'
import { PAUSES }                        from '../../../../lib/motion/timing.ts'
import { HeroReading }                   from '../../../../theme/components/front/hero-reading.tsx'
import { data }                          from '../../../common/data/front.ts'
import { test }                          from '../../../common/mount.ts'

vi.mock('../../../../lib/front/front.data.ts', () => import('../../../common/data/front.ts'))

const { day } = data

function card(host: HTMLElement): HTMLElement {
  return getByRole(host, 'group', { hidden: true, name: 'The reading in full' })
}

afterEach(() => {
  useFrontMinute().value = day.noon
})

test('shows the reading at noon on a button that controls the closed card', ({ mount }) => {
  const host   = mount(HeroReading)
  const button = getByRole(host, 'button')
  const noon   = useFrontFacts()[day.noon]!

  expect(button.textContent).toBe(`The reading at ${noon.time}${noon.reading} lux`)
  expect(button.getAttribute('aria-controls')).toBe(card(host).id)
  expect([button.getAttribute('aria-expanded'), card(host).inert]).toEqual(['false', true])
})

test('writes the figures of the minute the page moves to', async ({ mount }) => {
  const host  = mount(HeroReading)
  const facts = useFrontFacts()[day.rise]!

  useFrontMinute().value = day.rise
  await nextTick()

  expect(card(host).querySelector('[data-fact="phase"]')!.textContent).toBe(facts.phase)
  expect(card(host).querySelector('[data-fact="sun"]')!.textContent).toBe(facts.sun)
})

test('marks the reading assumed at a minute no forecast step covers', async ({ mount }) => {
  const host = mount(HeroReading)

  useFrontMinute().value = 0
  await nextTick()
  expect(host.firstElementChild!.hasAttribute('data-assumed')).toBe(true)

  useFrontMinute().value = day.window[0]
  await nextTick()
  expect(host.firstElementChild!.hasAttribute('data-assumed')).toBe(false)
})

test('opens the card after a pointer rests the dwell pause and closes it the leave pause after', async ({
  mount
}) => {
  const host = mount(HeroReading)
  const root = host.firstElementChild!

  fireEvent.pointerEnter(root)
  vi.advanceTimersByTime(PAUSES.dwell)
  await nextTick()
  expect(card(host).inert).toBe(false)

  fireEvent.pointerLeave(root)
  vi.advanceTimersByTime(PAUSES.leave)
  await nextTick()
  expect(card(host).inert).toBe(true)
})

test('pins the card open on a press, past the pointer leaving, until a second press', async ({ mount }) => {
  const host   = mount(HeroReading)
  const button = getByRole(host, 'button')

  fireEvent.click(button)
  await nextTick()
  fireEvent.pointerLeave(host.firstElementChild!)
  vi.advanceTimersByTime(PAUSES.leave)
  await nextTick()
  expect(card(host).inert).toBe(false)

  fireEvent.click(button)
  await nextTick()
  expect(card(host).inert).toBe(true)
})

test('closes a pinned card on Escape and returns the focus to its button', async ({ mount }) => {
  const host   = mount(HeroReading)
  const button = getByRole(host, 'button')

  fireEvent.click(button)
  await nextTick()
  fireEvent.keyDown(host.firstElementChild!, { key: 'Escape' })
  await nextTick()

  expect(card(host).inert).toBe(true)
  expect(document.activeElement).toBe(button)
})
