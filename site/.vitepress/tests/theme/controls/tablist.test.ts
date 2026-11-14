/** @vitest-environment happy-dom */
import { fireEvent, getAllByRole } from '@testing-library/dom'
import { expect, vi }              from 'vitest'
import { h, nextTick }             from 'vue'

import { PAUSES }            from '../../../lib/motion/timing.ts'
import { Tablist, tabPanel } from '../../../theme/controls/tablist.tsx'
import { test }              from '../../common/mount.ts'

const TABS = [{ label: 'One', style: { color: 'red' } }, { label: 'Two' }, { label: 'Three' }]

function props(select: (index: number) => void): Record<string, unknown> {
  return {
    classes  : { list: 'row-tabs', tab: 'row-tab' },
    id       : 'row',
    label    : 'The row',
    onSelect : select,
    selected : 1,
    tabs     : TABS
  }
}

test('marks the selected tab and leaves it the one tab stop', ({ mount }) => {
  const tabs = getAllByRole(mount(Tablist, props(vi.fn())), 'tab')

  expect(tabs.map((tab) => [tab.getAttribute('aria-selected'), tab.tabIndex]))
    .toEqual([['false', -1], ['true', 0], ['false', -1]])
})

test('names each tab for its label, with the style the tab sets', ({ mount }) => {
  const [tab] = getAllByRole(mount(Tablist, props(vi.fn())), 'tab')

  expect(tab!.id).toBe('row-tab-0')
  expect(tab!.getAttribute('aria-label')).toBe('One')
  expect(tab!.style.color).toBe('red')
})

test('ties the selected tab alone to the panel', ({ mount }) => {
  const tabs = getAllByRole(mount(Tablist, props(vi.fn())), 'tab')

  expect(tabs.map((tab) => tab.getAttribute('aria-controls'))).toEqual([null, 'row-panel', null])
})

test('labels the row', ({ mount }) => {
  expect(getAllByRole(mount(Tablist, props(vi.fn())), 'tablist')[0]!.getAttribute('aria-label'))
    .toBe('The row')
})

test('writes the id each tab carries', ({ mount }) => {
  const tabs = getAllByRole(mount(Tablist, props(vi.fn())), 'tab')

  expect(tabs.map((tab) => tab.id)).toEqual(TABS.map((_, index) => `row-tab-${index}`))
})

test('labels the panel with the tab that controls it', ({ mount }) => {
  const [, tab] = getAllByRole(mount(Tablist, props(vi.fn())), 'tab')

  expect(tabPanel('row', 1)).toEqual({
    'aria-labelledby' : tab!.id,
    id                : tab!.getAttribute('aria-controls'),
    role              : 'tabpanel',
    tabindex          : 0
  })
})

test('renders the slot inside each tab with its index', ({ mount }) => {
  const host = mount(Tablist, props(vi.fn()), ({ index }: { index: number }) => h('b', `Face ${index}`))

  expect(getAllByRole(host, 'tab').map((tab) => tab.textContent)).toEqual(['Face 0', 'Face 1', 'Face 2'])
})

test('selects on a click', ({ mount }) => {
  const select = vi.fn<(index: number) => void>()

  fireEvent.click(getAllByRole(mount(Tablist, props(select)), 'tab')[2]!)

  expect(select).toHaveBeenCalledExactlyOnceWith(2)
})

test.for([
  { expected: 0, from: 1, key: 'ArrowLeft' },
  { expected: 2, from: 1, key: 'ArrowRight' },
  { expected: 0, from: 1, key: 'Home' },
  { expected: 2, from: 1, key: 'End' },
  { expected: 0, from: 2, key: 'ArrowRight' },
  { expected: 2, from: 0, key: 'ArrowLeft' }
])('moves to tab $expected on $key from tab $from', async ({ expected, from, key }, { mount }) => {
  const select = vi.fn<(index: number) => void>()
  const tabs   = getAllByRole(mount(Tablist, props(select)), 'tab')

  tabs[from]!.focus()
  await nextTick()
  fireEvent.keyDown(tabs[from]!, { key })
  await vi.runOnlyPendingTimersAsync()

  expect(select).toHaveBeenCalledExactlyOnceWith(expected)
  expect(document.activeElement).toBe(tabs[expected])
})

test('selects once a mouse has rested on a tab for the dwell pause', ({ mount }) => {
  const select = vi.fn<(index: number) => void>()
  const [tab]  = getAllByRole(mount(Tablist, props(select)), 'tab')

  fireEvent.pointerEnter(tab!, { pointerType: 'mouse' })
  vi.advanceTimersByTime(PAUSES.dwell - 1)
  expect(select).not.toHaveBeenCalled()

  vi.advanceTimersByTime(1)
  expect(select).toHaveBeenCalledExactlyOnceWith(0)
})

test('selects nothing where the mouse leaves ahead of the dwell pause', ({ mount }) => {
  const select = vi.fn<(index: number) => void>()
  const [tab]  = getAllByRole(mount(Tablist, props(select)), 'tab')

  fireEvent.pointerEnter(tab!, { pointerType: 'mouse' })
  fireEvent.pointerLeave(tab!)
  vi.advanceTimersByTime(PAUSES.dwell)

  expect(select).not.toHaveBeenCalled()
})

test('drops the dwell timer when the row unmounts', ({ mount, unmount }) => {
  const host  = mount(Tablist, props(vi.fn()))
  const count = vi.getTimerCount()

  fireEvent.pointerEnter(getAllByRole(host, 'tab')[0]!, { pointerType: 'mouse' })
  expect(vi.getTimerCount()).toBe(count + 1)

  unmount()

  expect(vi.getTimerCount()).toBe(count)
})

test('selects nothing on a touch resting on a tab', ({ mount }) => {
  const select = vi.fn<(index: number) => void>()
  const [tab]  = getAllByRole(mount(Tablist, props(select)), 'tab')

  fireEvent.pointerEnter(tab!, { pointerType: 'touch' })
  vi.advanceTimersByTime(PAUSES.dwell)

  expect(select).not.toHaveBeenCalled()
})
