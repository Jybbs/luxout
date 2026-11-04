/** @vitest-environment happy-dom */
import { fireEvent }                                        from '@testing-library/dom'
import { type Mock, afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope }                                      from 'vue'

import { PAUSES }     from '../../../lib/motion/timing.ts'
import { PlotSlider } from '../../../theme/controls/plot-slider.ts'

const AT = 40

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
  element.addEventListener('blur', instance.onBlur)
  element.addEventListener('keydown', instance.onKeydown)
  element.addEventListener('pointerdown', instance.onPointerdown)
  element.addEventListener('pointerleave', instance.onPointerleave)
  element.addEventListener('pointermove', instance.onPointermove)
  element.addEventListener('pointerup', instance.onPointerup)

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
  { expected: 9, key: 'PageUp', value: 9 },
  { expected: 0, key: 'PageDown', value: 0 }
])('holds the value inside the range on $key at $value', ({ expected, key, value }) => {
  const { element, set } = slider(value)

  fireEvent.keyDown(element, { key })

  expect(set).toHaveBeenCalledExactlyOnceWith(expected, true)
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
