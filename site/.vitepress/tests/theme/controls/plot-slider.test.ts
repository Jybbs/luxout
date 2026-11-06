/** @vitest-environment happy-dom */
import { fireEvent }                                        from '@testing-library/dom'
import { type Mock, afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope }                                      from 'vue'

import { PAUSES }                  from '../../../lib/motion/timing.ts'
import { PlotSlider, shareAcross } from '../../../theme/controls/plot-slider.ts'

const AT = 40

function restless(): PlotSlider {
  return new PlotSlider({ count: 10, page: 3, position: () => AT, set: () => undefined, value: () => 5 })
}

function slider(value = 5): {
  capture : Mock<HTMLElement['setPointerCapture']>
  element : HTMLElement
  rest    : Mock<() => void>
  set     : Mock<(value: number, eased: boolean) => void>
} {
  const capture  = vi.fn<HTMLElement['setPointerCapture']>()
  const element  = document.createElement('div')
  const rest     = vi.fn<() => void>()
  const set      = vi.fn<(value: number, eased: boolean) => void>()
  const instance = new PlotSlider({
    count    : 10,
    page     : 3,
    position : () => AT,
    rest     : rest,
    set      : set,
    value    : () => value
  })

  document.body.append(element)
  element.tabIndex          = 0
  element.setPointerCapture = capture

  for (const [name, listener] of Object.entries(instance.listeners)) {
    element.addEventListener(name.slice(2).toLowerCase(), listener as EventListener)
  }

  return { capture, element, rest, set }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  document.body.replaceChildren()
  vi.useRealTimers()
})

it.each([
  { expected: 4, key: 'ArrowDown' },
  { expected: 4, key: 'ArrowLeft' },
  { expected: 6, key: 'ArrowRight' },
  { expected: 6, key: 'ArrowUp' },
  { expected: 9, key: 'End' },
  { expected: 0, key: 'Home' },
  { expected: 2, key: 'PageDown' },
  { expected: 8, key: 'PageUp' }
])('eases to $expected on $key', ({ expected, key }) => {
  const { element, set } = slider()

  expect(fireEvent.keyDown(element, { key })).toBe(false)
  expect(set).toHaveBeenCalledExactlyOnceWith(expected, true)
})

it.each([
  { key: 'PageUp', value: 9 },
  { key: 'PageDown', value: 0 }
])('holds the value inside the range on $key at $value', ({ key, value }) => {
  const { element, set } = slider(value)

  fireEvent.keyDown(element, { key })

  expect(set).toHaveBeenCalledExactlyOnceWith(value, true)
})

it('leaves every other key to the browser', () => {
  const { element, set } = slider()

  expect(fireEvent.keyDown(element, { key: 'Tab' })).toBe(true)
  expect(set).not.toHaveBeenCalled()
})

it('sets the value where a press lands and captures the pointer', () => {
  const { capture, element, set } = slider()

  expect(fireEvent.pointerDown(element, { button: 0, pointerId: 3 })).toBe(false)
  expect(set).toHaveBeenCalledExactlyOnceWith(AT, false)
  expect(capture).toHaveBeenCalledWith(3)
  expect(document.activeElement).toBe(element)
})

it('ignores a press of any other button', () => {
  const { element, set } = slider()

  fireEvent.pointerDown(element, { button: 2 })

  expect(set).not.toHaveBeenCalled()
})

it('follows a drag until the pointer lifts', () => {
  const { element, set } = slider()

  fireEvent.pointerDown(element, { button: 0 })
  fireEvent.pointerMove(element, { pointerType: 'touch' })
  fireEvent.pointerUp(element)
  fireEvent.pointerMove(element, { pointerType: 'touch' })

  expect(set).toHaveBeenCalledTimes(2)
})

it('sets the value once a mouse has rested for the dwell pause, then follows it', () => {
  const { element, set } = slider()

  fireEvent.pointerMove(element, { pointerType: 'mouse' })
  vi.advanceTimersByTime(PAUSES.dwell - 1)
  expect(set).not.toHaveBeenCalled()

  vi.advanceTimersByTime(1)
  expect(set).toHaveBeenCalledOnce()

  fireEvent.pointerMove(element, { pointerType: 'mouse' })
  expect(set).toHaveBeenCalledTimes(2)
})

it('drops a resting mouse’s pending position once a press takes over', () => {
  const { element, set } = slider()

  fireEvent.pointerMove(element, { pointerType: 'mouse' })
  fireEvent.pointerDown(element, { button: 0 })
  vi.advanceTimersByTime(PAUSES.dwell)

  expect(set).toHaveBeenCalledOnce()
})

it('ignores a touch moving with no press', () => {
  const { element, set } = slider()

  fireEvent.pointerMove(element, { pointerType: 'touch' })
  vi.advanceTimersByTime(PAUSES.dwell)

  expect(set).not.toHaveBeenCalled()
})

it('returns to rest once a pointer has left for the leave pause', () => {
  const { element, rest } = slider()

  fireEvent.pointerLeave(element)
  vi.advanceTimersByTime(PAUSES.leave - 1)
  expect(rest).not.toHaveBeenCalled()

  vi.advanceTimersByTime(1)
  expect(rest).toHaveBeenCalledOnce()
})

it('stays where it is while the slider holds focus', () => {
  const { element, rest } = slider()

  element.focus()
  fireEvent.pointerLeave(element)
  vi.advanceTimersByTime(PAUSES.leave)

  expect(rest).not.toHaveBeenCalled()
})

it('stays where it is while a drag continues outside the slider', () => {
  const { element, rest } = slider()

  fireEvent.pointerDown(element, { button: 0 })
  element.blur()
  rest.mockClear()
  fireEvent.pointerLeave(element)
  vi.advanceTimersByTime(PAUSES.leave)

  expect(rest).not.toHaveBeenCalled()
})

it('cancels the leave pause once the pointer returns', () => {
  const { element, rest } = slider()

  fireEvent.pointerLeave(element)
  fireEvent.pointerMove(element, { pointerType: 'touch' })
  vi.advanceTimersByTime(PAUSES.leave)

  expect(rest).not.toHaveBeenCalled()
})

it('returns to rest when the focus leaves', () => {
  const { element, rest } = slider()

  element.focus()
  element.blur()

  expect(rest).toHaveBeenCalledOnce()
})

it('cancels every pause once its scope stops', () => {
  const scope                  = effectScope()
  const { element, rest, set } = scope.run(() => slider())!

  fireEvent.pointerMove(element, { pointerType: 'mouse' })
  fireEvent.pointerLeave(element)
  scope.stop()
  vi.advanceTimersByTime(PAUSES.dwell + PAUSES.leave)

  expect(rest).not.toHaveBeenCalled()
  expect(set).not.toHaveBeenCalled()
})

it('does nothing on a blur or a leave where a slider holds no resting value', () => {
  const { listeners } = restless()
  const element       = document.createElement('div')

  expect(() => {
    listeners.onBlur()
    listeners.onPointerleave({ currentTarget: element } as unknown as PointerEvent)
    vi.advanceTimersByTime(PAUSES.leave)
  }).not.toThrow()
})

it('ends a drag when the pointer is cancelled', () => {
  const { element, set } = slider()

  fireEvent.pointerDown(element, { button: 0, clientX: AT, pointerId: 1 })
  fireEvent.pointerCancel(element, { pointerId: 1 })
  fireEvent.pointerMove(element, { clientX: AT, pointerType: 'touch' })

  expect(set).toHaveBeenCalledOnce()
})

it('builds the attributes of an ARIA slider, reading its maximum from its count', () => {
  const instance = restless()

  expect(instance.attributes('Some value', 4, 'four')).toEqual({
    'aria-label'     : 'Some value',
    'aria-valuemax'  : 9,
    'aria-valuemin'  : 0,
    'aria-valuenow'  : 4,
    'aria-valuetext' : 'four',
    role             : 'slider',
    tabindex         : 0,
    ...instance.listeners
  })
})

it.each([
  { clientX: 250, expected: 0.5, name: 'the middle' },
  { clientX: 0, expected: 0, name: 'a pointer before the left edge' },
  { clientX: 900, expected: 1, name: 'a pointer past the right edge' }
])('finds the share across the whole element at $name', ({ clientX, expected }) => {
  const element = document.createElement('div')

  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 300 } as DOMRect)

  expect(shareAcross(element, clientX)).toBe(expected)
})

it.each([
  { clientX: 75, expected: 0, name: 'the plot’s left edge' },
  { clientX: 250, expected: 0.5, name: 'the plot’s middle' },
  { clientX: 425, expected: 1, name: 'the plot’s right edge' },
  { clientX: 480, expected: 1, name: 'the margin past the plot' }
])('finds the share across an inset plot at $name', ({ clientX, expected }) => {
  const element = document.createElement('div')

  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 500 } as DOMRect)

  expect(shareAcross(element, clientX, { left: 150, right: 850, width: 1000 })).toBe(expected)
})
