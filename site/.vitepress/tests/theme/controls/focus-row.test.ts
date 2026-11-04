/** @vitest-environment happy-dom */
import { range }                     from 'd3-array'
import { afterEach, expect, it, vi } from 'vitest'

import { FocusRow } from '../../../theme/controls/focus-row.ts'

function press(key: string): KeyboardEvent {
  return new KeyboardEvent('keydown', { cancelable: true, key })
}

function row(moved?: (index: number) => void): { buttons: HTMLButtonElement[], focus: FocusRow } {
  const buttons = range(3).map(() => document.createElement('button'))
  const focus   = new FocusRow('ArrowRight', 'ArrowLeft', moved)

  document.body.append(...buttons)
  buttons.forEach((button, index) => focus.keep(button, index))

  return { buttons, focus }
}

afterEach(() => {
  document.body.replaceChildren()
})

it.each([
  { expected: 1, from: 0, key: 'ArrowRight' },
  { expected: 0, from: 2, key: 'ArrowRight' },
  { expected: 1, from: 2, key: 'ArrowLeft' },
  { expected: 2, from: 0, key: 'ArrowLeft' },
  { expected: 2, from: 1, key: 'End' },
  { expected: 0, from: 1, key: 'Home' }
])('moves to button $expected on $key from button $from', ({ expected, from, key }) => {
  const moved              = vi.fn<(index: number) => void>()
  const { buttons, focus } = row(moved)
  const event              = press(key)

  focus.move(event, from)

  expect(event.defaultPrevented).toBe(true)
  expect(moved).toHaveBeenCalledExactlyOnceWith(expected)
  expect(document.activeElement).toBe(buttons[expected])
})

it('moves the focus on a row with no callback', () => {
  const { buttons, focus } = row()

  focus.move(press('End'), 0)

  expect(document.activeElement).toBe(buttons[2])
})

it('leaves every other key to the browser', () => {
  const moved     = vi.fn<(index: number) => void>()
  const { focus } = row(moved)
  const event     = press('Tab')

  focus.move(event, 0)

  expect(event.defaultPrevented).toBe(false)
  expect(moved).not.toHaveBeenCalled()
})

it('keeps a button when its ref clears on an unmount', () => {
  const { buttons, focus } = row()

  focus.keep(null, 0)
  focus.move(press('Home'), 1)

  expect(document.activeElement).toBe(buttons[0])
})
