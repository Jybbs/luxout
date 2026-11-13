/** @vitest-environment happy-dom */
import { fireEvent, getAllByRole } from '@testing-library/dom'
import { expect, vi }              from 'vitest'
import { nextTick }                from 'vue'

import { PAUSES }       from '../../../../lib/motion/timing.ts'
import { RoundedPlace } from '../../../../theme/components/privacy/rounded-place.ts'
import { data }         from '../../../common/data/privacy.ts'
import { test }         from '../../../common/mount.ts'

vi.mock('../../../../lib/privacy/privacy.data.ts', () => import('../../../common/data/privacy.ts'))

const { place }      = data
const [pairX, pairY] = place.pair

function plotOf(host: HTMLElement): HTMLElement {
  const plot = host.querySelector<HTMLElement>('.rounded-place-plot')!

  vi.spyOn(plot, 'getBoundingClientRect')
    .mockReturnValue({ height: place.height, left: 0, top: 0, width: place.width } as DOMRect)

  return plot
}

function shown(host: HTMLElement): string | undefined {
  return host.querySelector<HTMLElement>('.rounded-place')!.dataset.shown
}

async function wait(milliseconds: number): Promise<void> {
  vi.advanceTimersByTime(milliseconds)
  await nextTick()
}

test('keys each mark as a row naming it beside its figure', ({ mount }) => {
  const rows = getAllByRole(mount(RoundedPlace), 'button')

  expect(rows.map((row) => [...row.querySelectorAll('span')].map(({ textContent }) => textContent)))
    .toEqual(place.marks.map(({ name, value }) => [name, value]))
})

test('opens with no mark brought forward', ({ mount }) => {
  expect(shown(mount(RoundedPlace))).toBeUndefined()
})

test('brings a row’s mark forward while the row holds focus and clears it on Escape', async ({ mount }) => {
  const host       = mount(RoundedPlace)
  const [, , area] = getAllByRole(host, 'button')

  fireEvent.focus(area!)
  await nextTick()

  expect(shown(host)).toBe('area')
  expect(area!.classList).toContain('on')

  fireEvent.keyDown(area!, { key: 'Escape' })
  await nextTick()

  expect(shown(host)).toBeUndefined()
})

test('brings a clicked row’s mark forward at once and clears it on blur', async ({ mount }) => {
  const host  = mount(RoundedPlace)
  const [row] = getAllByRole(host, 'button')

  fireEvent.click(row!)
  await nextTick()

  expect(shown(host)).toBe('place')

  fireEvent.blur(row!)
  await nextTick()

  expect(shown(host)).toBeUndefined()
})

test('keeps a focused row’s mark forward once a mouse leaves the row', async ({ mount }) => {
  const host  = mount(RoundedPlace)
  const [row] = getAllByRole(host, 'button')

  row!.focus()
  fireEvent.pointerLeave(row!)
  await wait(PAUSES.leave)

  expect(shown(host)).toBe('place')
})

test('brings a row’s mark forward once a mouse rests on it past the dwell pause', async ({ mount }) => {
  const host   = mount(RoundedPlace)
  const [cell] = getAllByRole(host, 'button').slice(-1)

  fireEvent.pointerEnter(cell!)
  await wait(PAUSES.dwell - 1)

  expect(shown(host)).toBeUndefined()

  await wait(1)

  expect(shown(host)).toBe('cell')

  fireEvent.pointerLeave(cell!)
  await wait(PAUSES.leave)

  expect(shown(host)).toBeUndefined()
})

test('names the mark a mouse rests on over the drawing, in the drawing’s units', async ({ mount }) => {
  const host = mount(RoundedPlace)
  const plot = plotOf(host)

  fireEvent.pointerMove(plot, { clientX: place.cell.x + 2, clientY: place.cell.y + 2, pointerType: 'mouse' })
  await wait(PAUSES.dwell)

  expect(shown(host)).toBe('cell')

  fireEvent.pointerMove(plot, { clientX: place.area.x + 2, clientY: place.area.y + 2, pointerType: 'mouse' })
  await wait(PAUSES.dwell)

  expect(shown(host)).toBe('area')

  fireEvent.pointerLeave(plot, { pointerType: 'mouse' })
  await wait(PAUSES.leave)

  expect(shown(host)).toBeUndefined()
})

test('keeps the mark a mouse moves within, with no new dwell', async ({ mount }) => {
  const host = mount(RoundedPlace)
  const plot = plotOf(host)
  const [x, y] = [place.cell.x + 2, place.cell.y + 2]

  fireEvent.pointerMove(plot, { clientX: x, clientY: y, pointerType: 'mouse' })
  await wait(PAUSES.dwell - 1)
  fireEvent.pointerMove(plot, { clientX: x + 1, clientY: y, pointerType: 'mouse' })
  await wait(1)

  expect(shown(host)).toBe('cell')
})

test('brings a tapped mark forward at once', async ({ mount }) => {
  const host = mount(RoundedPlace)

  fireEvent.pointerDown(plotOf(host), { clientX: pairX, clientY: pairY, pointerType: 'touch' })
  await nextTick()

  expect(shown(host)).toBe('place')
})

test('keeps a tapped mark forward once the touch leaves the drawing', async ({ mount }) => {
  const host = mount(RoundedPlace)
  const plot = plotOf(host)

  fireEvent.pointerDown(plot, { clientX: place.cell.x + 2, clientY: place.cell.y + 2, pointerType: 'touch' })
  fireEvent.pointerLeave(plot, { pointerType: 'touch' })
  await wait(PAUSES.leave)

  expect(shown(host)).toBe('cell')
})

test('brings no mark forward as a touch moves over the drawing', async ({ mount }) => {
  const host = mount(RoundedPlace)

  fireEvent.pointerMove(plotOf(host), { clientX: pairX, clientY: pairY, pointerType: 'touch' })
  await wait(PAUSES.dwell)

  expect(shown(host)).toBeUndefined()
})

test('leaves a mouse press on the drawing to the dwell', async ({ mount }) => {
  const host = mount(RoundedPlace)

  fireEvent.pointerDown(plotOf(host), { clientX: pairX, clientY: pairY, pointerType: 'mouse' })
  await nextTick()

  expect(shown(host)).toBeUndefined()
})
