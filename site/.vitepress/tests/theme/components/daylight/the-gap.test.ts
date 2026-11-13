/** @vitest-environment happy-dom */
import { fireEvent, getByRole } from '@testing-library/dom'
import { expect, vi }           from 'vitest'
import { nextTick }             from 'vue'

import { DURATIONS, PAUSES }               from '../../../../lib/motion/timing.ts'
import { TheGap }                          from '../../../../theme/components/daylight/the-gap.tsx'
import { data }                            from '../../../common/data/daylight.ts'
import { keyOn, pointed, pressable, test } from '../../../common/mount.ts'

vi.mock('../../../../lib/daylight/daylight.data.ts', () => import('../../../common/data/daylight.ts'))

const { gap } = data
const wide    = gap.layouts.at(-1)!

function frames(): void {
  vi.advanceTimersByTime(DURATIONS.move + 32)
}

async function pointTo(host: HTMLElement): Promise<HTMLElement> {
  const slider = getByRole(host, 'slider')

  await keyOn(slider, 'Home')
  frames()

  return slider
}

function sliderOverPlot(host: HTMLElement): HTMLElement {
  const slider = getByRole(host, 'slider')

  pressable(slider, { left: wide.left, width: wide.right - wide.left })

  return slider
}

function transforms(host: HTMLElement, selector: string): (string | null)[] {
  return [...host.querySelectorAll(selector)].map((element) => element.getAttribute('transform'))
}

test('draws one plot per layout, each with its cursor at the resting minute', ({ mount }) => {
  expect(transforms(mount(TheGap), '.the-gap-cursor'))
    .toEqual(gap.layouts.map(({ x }) => `translate(${x[gap.rest]} 0)`))
})

test('opens on the two sensors’ levels and their whole counts', ({ mount }) => {
  const table = mount(TheGap).querySelector('table')!
  const rows  = [...table.querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('td')].map(({ textContent }) => textContent)
  )

  expect(table.querySelector('caption')!.textContent).toBe(`From ${gap.span[0]} to ${gap.span[1]}`)
  expect(rows).toEqual([
    gap.sensors.map(({ onAt }) => onAt),
    gap.sensors.map(({ offBelow }) => offBelow),
    ['Point along the morning'],
    gap.sensors.map(({ switches }) => String(switches))
  ])
})

test('names the resting minute on the slider', ({ mount }) => {
  const slider = getByRole(mount(TheGap), 'slider')

  expect(slider.getAttribute('aria-valuenow')).toBe(String(gap.rest))
  expect(slider.getAttribute('aria-valuetext')).toBe(gap.minutes[gap.rest]!.reading)
})

test('moves the cursors and the slider’s value on a key', async ({ mount }) => {
  const host   = mount(TheGap)
  const slider = await pointTo(host)
  const moves  = gap.layouts.map(({ x }) => `translate(${x[0]} 0)`)

  expect(slider.getAttribute('aria-valuenow')).toBe('0')
  expect(slider.getAttribute('aria-valuetext')).toBe(gap.minutes[0]!.reading)
  expect(transforms(host, '.the-gap-cursor')).toEqual(moves)
})

test('moves each cursor’s dot and thumb to the reading at the pointed minute', async ({ mount }) => {
  const host = mount(TheGap)

  await pointTo(host)

  expect(transforms(host, '.the-gap-mark')).toEqual(gap.layouts.map(({ y }) => `translate(0 ${y[0]})`))
})

test('steps once per key while a motion is still under way', async ({ mount }) => {
  const host   = mount(TheGap)
  const slider = await pointTo(host)

  for (const _ of [1, 2, 3]) {
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    await nextTick()
  }
  frames()

  expect(slider.getAttribute('aria-valuenow')).toBe('3')
})

test('sets out the pointed minute in the table once the motion ends', async ({ mount }) => {
  const host = mount(TheGap)

  await pointTo(host)
  await nextTick()

  const { cells, clock, lux } = gap.minutes[0]!
  const table                 = host.querySelector('table')!

  expect(table.querySelector('caption')!.textContent).toBe(`${clock} · ${lux} lux`)
  expect(table.textContent).toContain(cells[0]!.word)
  expect(table.textContent).toContain(cells[1]!.count)
  expect([...table.querySelectorAll('.the-gap-swatch > *')].map((mark) => mark.getAttribute('class')))
    .toEqual(cells.map(({ mark }) => `the-gap-${mark}`))
})

test('speaks the pointed minute once the speech pause has passed', async ({ mount }) => {
  const host = mount(TheGap)

  await pointTo(host)
  vi.advanceTimersByTime(PAUSES.speech)
  await nextTick()

  expect(host.querySelector('[aria-live]')!.textContent).toBe(gap.minutes[0]!.spoken)
})

test('returns to the resting minute when the slider loses focus', async ({ mount }) => {
  const host   = mount(TheGap)
  const slider = await pointTo(host)

  expect(host.querySelector('.the-gap')!.hasAttribute('data-pointing')).toBe(true)

  slider.blur()
  await nextTick()

  expect(slider.getAttribute('aria-valuenow')).toBe(String(gap.rest))
  expect(host.querySelector('caption')!.textContent).toBe(`From ${gap.span[0]} to ${gap.span[1]}`)
  expect(host.querySelector('.the-gap')!.hasAttribute('data-pointing')).toBe(false)
})

test('speaks nothing of a minute the reader left inside the speech pause', async ({ mount }) => {
  const host   = mount(TheGap)
  const slider = await pointTo(host)

  slider.blur()
  vi.advanceTimersByTime(PAUSES.speech)
  await nextTick()

  expect(host.querySelector('[aria-live]')!.textContent).toBe('')
})

test.for([
  { clientX: wide.x[30]!, expected: 30, name: 'the minute under the press' },
  { clientX: 9_999, expected: gap.minutes.length - 1, name: 'the last minute beyond the plot' },
  { clientX: -9_999, expected: 0, name: 'the first minute ahead of the plot' }
])('sets $name through the plot on screen', async ({ clientX, expected }, { mount }) => {
  const slider = sliderOverPlot(mount(TheGap))

  fireEvent.pointerDown(slider.parentElement!, { button: 0, clientX })
  await pointed()

  expect(slider.getAttribute('aria-valuenow')).toBe(String(expected))
})

test.for(['pointerCancel', 'pointerUp'] as const)('ends a drag on %s', async (ending, { mount }) => {
  const slider = sliderOverPlot(mount(TheGap))

  fireEvent.pointerDown(slider.parentElement!, { button: 0, clientX: wide.x[30]! })
  await pointed()
  fireEvent[ending](document)
  fireEvent.pointerMove(document, { clientX: wide.x[60]!, pointerType: 'touch' })
  await pointed()

  expect(slider.getAttribute('aria-valuenow')).toBe('30')
})

test('returns to the resting minute once a pointer has left for the leave pause', async ({ mount }) => {
  const slider = sliderOverPlot(mount(TheGap))

  fireEvent.pointerMove(slider.parentElement!, { clientX: wide.x[30]!, pointerType: 'mouse' })
  vi.advanceTimersByTime(PAUSES.dwell)
  await nextTick()
  expect(slider.getAttribute('aria-valuenow')).toBe('30')

  fireEvent.pointerLeave(slider.parentElement!)
  vi.advanceTimersByTime(PAUSES.leave)
  await nextTick()

  expect(slider.getAttribute('aria-valuenow')).toBe(String(gap.rest))
})

test('leaves no frame and no timer running once unmounted', async ({ mount, unmount }) => {
  const slider = await pointTo(mount(TheGap))
  const idle   = vi.getTimerCount()

  fireEvent.keyDown(slider, { key: 'ArrowRight' })
  expect(vi.getTimerCount()).toBeGreaterThan(idle)

  unmount()

  expect(vi.getTimerCount()).toBe(0)
})

test('says what a ring means beside the drawing', ({ mount }) => {
  const key = mount(TheGap).querySelector('.widget-note')!

  expect(key.textContent).toContain('Each ring is a switch')
  expect(key.querySelector('.the-gap-swatch .the-gap-ring')).not.toBeNull()
})
