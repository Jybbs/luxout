/** @vitest-environment happy-dom */
import { fireEvent, getByRole }      from '@testing-library/dom'
import { type Mock, expect, vi }     from 'vitest'
import { defineComponent, nextTick } from 'vue'

import { PAUSES }                                      from '../../../lib/motion/timing.ts'
import { OVERLAY, PlotSlider, plotSpans }              from '../../../theme/controls/plot-slider.tsx'
import { type Mount, keyOn, pointed, pressable, test } from '../../common/mount.ts'

/**
 * A slider of ten values opening on 5, with the spies its options call and the
 * instance a case holds.
 */
interface Harness {
  readonly instance : PlotSlider
  readonly rest     : Mock<() => void>
  readonly set      : Mock<(value: number, eased: boolean) => void>
  readonly slider   : HTMLElement
}

function harness(mount: Mount, resting = true, at?: string): Harness {
  const rest = vi.fn<() => void>()
  const set  = vi.fn<(value: number, eased: boolean) => void>((value) => {
    shown = value
  })
  let instance: PlotSlider | undefined
  let shown = 5

  const host = mount(defineComponent({
    setup() {
      instance = new PlotSlider({
        count : 10,
        label : 'Some value',
        page  : 3,
        rest  : resting ? rest : undefined,
        set   : set,
        text  : (value) => `at ${value}`,
        value : () => shown
      })

      return () => instance!.render(at ? { ...OVERLAY, at } : OVERLAY)
    }
  }))
  const slider = getByRole(host, 'slider')

  pressable(slider, { left: 0, width: 90 })

  return { instance: instance!, rest, set, slider }
}

async function hover(slider: HTMLElement, clientX: number): Promise<void> {
  fireEvent.pointerMove(slider.parentElement!, { clientX, pointerType: 'mouse' })
  vi.advanceTimersByTime(PAUSES.dwell)
  await nextTick()
}

test('names the slider and its value through the machine’s ARIA slider', ({ mount }) => {
  const { slider } = harness(mount)

  expect([
    slider.getAttribute('aria-label'),
    slider.getAttribute('aria-valuemin'),
    slider.getAttribute('aria-valuemax'),
    slider.getAttribute('aria-valuenow'),
    slider.getAttribute('aria-valuetext')
  ]).toEqual(['Some value', '0', '9', '5', 'at 5'])
})

test.for([
  { expected: 4, key: 'ArrowDown' },
  { expected: 4, key: 'ArrowLeft' },
  { expected: 6, key: 'ArrowRight' },
  { expected: 6, key: 'ArrowUp' },
  { expected: 9, key: 'End' },
  { expected: 0, key: 'Home' },
  { expected: 3, key: 'PageDown' },
  { expected: 9, key: 'PageUp' }
])('eases to $expected on $key', async ({ expected, key }, { mount }) => {
  const { set, slider } = harness(mount)

  await keyOn(slider, key)
  await nextTick()

  expect(set).toHaveBeenCalledExactlyOnceWith(expected, true)
  expect(slider.getAttribute('aria-valuenow')).toBe(String(expected))
})

test('leaves every other key to the browser', async ({ mount }) => {
  const { set, slider } = harness(mount)

  slider.focus()
  await nextTick()

  expect(fireEvent.keyDown(slider, { key: 'Tab' })).toBe(true)
  expect(set).not.toHaveBeenCalled()
})

test('takes up the value the widget shows as the thumb takes the focus', async ({ mount }) => {
  const { instance, set, slider } = harness(mount)

  instance.hold(7)
  await nextTick()

  expect(slider.getAttribute('aria-valuenow')).toBe('7')
  expect(set).not.toHaveBeenCalled()

  slider.focus()
  await nextTick()

  expect(slider.getAttribute('aria-valuenow')).toBe('5')
  expect(set).not.toHaveBeenCalled()
})

test(
  'sets the value where a press lands, with no easing, and follows the drag until it lifts',
  async ({ mount }) => {
    const { set, slider } = harness(mount)

    fireEvent.pointerDown(slider.parentElement!, { button: 0, clientX: 40, pointerId: 1 })
    await pointed()
    fireEvent.pointerMove(document, { clientX: 80, pointerId: 1 })
    await pointed()
    fireEvent.pointerUp(document, { pointerId: 1 })
    fireEvent.pointerMove(document, { clientX: 10, pointerId: 1 })
    await pointed()

    expect(set.mock.calls).toEqual([[4, false], [8, false]])
  }
)

test('ignores a press of any other button', async ({ mount }) => {
  const { set, slider } = harness(mount)

  fireEvent.pointerDown(slider.parentElement!, { button: 2, clientX: 40 })
  await pointed()

  expect(set).not.toHaveBeenCalled()
})

test('sets the value once a mouse has rested for the dwell pause, then follows it', async ({ mount }) => {
  const { set, slider } = harness(mount)

  fireEvent.pointerMove(slider.parentElement!, { clientX: 20, pointerType: 'mouse' })
  vi.advanceTimersByTime(PAUSES.dwell - 1)
  expect(set).not.toHaveBeenCalled()

  vi.advanceTimersByTime(1)
  await nextTick()
  fireEvent.pointerMove(slider.parentElement!, { clientX: 70, pointerType: 'mouse' })
  await nextTick()

  expect(set.mock.calls).toEqual([[2, false], [7, false]])
})

test('drops a resting mouse’s pending value once a press takes over', async ({ mount }) => {
  const { set, slider } = harness(mount)

  fireEvent.pointerMove(slider.parentElement!, { clientX: 20, pointerType: 'mouse' })
  fireEvent.pointerDown(slider.parentElement!, { button: 0, clientX: 40, pointerId: 1 })
  await pointed()
  vi.advanceTimersByTime(PAUSES.dwell)

  expect(set).toHaveBeenCalledExactlyOnceWith(4, false)
})

test('ignores a touch moving with no press', ({ mount }) => {
  const { set, slider } = harness(mount)

  fireEvent.pointerMove(slider.parentElement!, { clientX: 20, pointerType: 'touch' })
  vi.advanceTimersByTime(PAUSES.dwell)

  expect(set).not.toHaveBeenCalled()
})

test('returns to rest once a pointer has left an unfocused slider for the leave pause', async ({ mount }) => {
  const { rest, slider } = harness(mount)

  await hover(slider, 20)
  fireEvent.pointerLeave(slider.parentElement!)
  vi.advanceTimersByTime(PAUSES.leave - 1)
  expect(rest).not.toHaveBeenCalled()

  vi.advanceTimersByTime(1)
  expect(rest).toHaveBeenCalledOnce()
})

test('stays where it is while the thumb holds the focus', async ({ mount }) => {
  const { rest, slider } = harness(mount)

  slider.focus()
  await nextTick()
  fireEvent.pointerLeave(slider.parentElement!)
  vi.advanceTimersByTime(PAUSES.leave)

  expect(rest).not.toHaveBeenCalled()
})

test('cancels the leave pause once the pointer returns', ({ mount }) => {
  const { rest, slider } = harness(mount)

  fireEvent.pointerLeave(slider.parentElement!)
  fireEvent.pointerMove(slider.parentElement!, { clientX: 20, pointerType: 'touch' })
  vi.advanceTimersByTime(PAUSES.leave)

  expect(rest).not.toHaveBeenCalled()
})

test('returns to rest when the focus leaves', async ({ mount }) => {
  const { rest, slider } = harness(mount)

  slider.focus()
  await nextTick()
  slider.blur()

  expect(rest).toHaveBeenCalledOnce()
})

test('cancels every pause once the slider unmounts', ({ mount, unmount }) => {
  const { rest, set, slider } = harness(mount)

  fireEvent.pointerMove(slider.parentElement!, { clientX: 20, pointerType: 'mouse' })
  fireEvent.pointerLeave(slider.parentElement!)
  unmount()
  vi.advanceTimersByTime(PAUSES.dwell + PAUSES.leave)

  expect(rest).not.toHaveBeenCalled()
  expect(set).not.toHaveBeenCalled()
})

test('does nothing on a blur or a leave where a slider holds no resting value', async ({ mount }) => {
  const { slider } = harness(mount, false)

  slider.focus()
  await nextTick()

  expect(() => {
    slider.blur()
    fireEvent.pointerLeave(slider.parentElement!)
    vi.advanceTimersByTime(PAUSES.leave)
  }).not.toThrow()
})

test('starts a thumb on a track where its look places it, through the `--at` property', ({ mount }) => {
  const { slider } = harness(mount, true, '40%')

  expect(slider.style.getPropertyValue('--at')).toBe('40%')
  expect(slider.classList.contains('left-(--at)')).toBe(true)
})

test('writes where each layout’s plot starts and ends as a share of its drawing', () => {
  expect(plotSpans([{ left: 50, right: 450, width: 500 }, { left: 0, right: 300, width: 400 }])).toEqual({
    '--plot-left-0'  : '0.1',
    '--plot-left-1'  : '0',
    '--plot-right-0' : '0.9',
    '--plot-right-1' : '0.75'
  })
})
