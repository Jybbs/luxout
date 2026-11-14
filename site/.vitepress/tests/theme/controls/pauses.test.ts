import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { PAUSES } from '../../../lib/motion/timing.ts'
import { Pauses } from '../../../theme/controls/pauses.ts'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

it('runs the dwell callback with its arguments once the dwell pause passes', () => {
  const dwell  = vi.fn<(index: number, side: string) => void>()
  const pauses = new Pauses(dwell)

  pauses.dwell.start(2, 'east')
  vi.advanceTimersByTime(PAUSES.dwell - 1)

  expect(dwell).not.toHaveBeenCalled()

  vi.advanceTimersByTime(1)

  expect(dwell).toHaveBeenCalledExactlyOnceWith(2, 'east')
})

it('runs the leave callback once the leave pause passes', () => {
  const leave  = vi.fn<() => void>()
  const pauses = new Pauses(vi.fn<() => void>(), leave)

  pauses.leave.start()
  vi.advanceTimersByTime(PAUSES.leave - 1)

  expect(leave).not.toHaveBeenCalled()

  vi.advanceTimersByTime(1)

  expect(leave).toHaveBeenCalledOnce()
})

it('begins the dwell pause again on each start', () => {
  const dwell  = vi.fn<(index: number) => void>()
  const pauses = new Pauses(dwell)

  pauses.dwell.start(0)
  vi.advanceTimersByTime(PAUSES.dwell - 1)
  pauses.dwell.start(1)
  vi.advanceTimersByTime(PAUSES.dwell - 1)

  expect(dwell).not.toHaveBeenCalled()

  vi.advanceTimersByTime(1)

  expect(dwell).toHaveBeenCalledExactlyOnceWith(1)
})

it('keeps both callbacks from running once stopped', () => {
  const dwell  = vi.fn<() => void>()
  const leave  = vi.fn<() => void>()
  const pauses = new Pauses(dwell, leave)

  pauses.dwell.start()
  pauses.leave.start()
  pauses.stop()
  vi.advanceTimersByTime(PAUSES.dwell + PAUSES.leave)

  expect([dwell, leave].map(({ mock }) => mock.calls.length)).toEqual([0, 0])
  expect(vi.getTimerCount()).toBe(0)
})

it('waits through the leave pause with nothing to run where no leave callback is given', () => {
  const pauses = new Pauses(vi.fn<() => void>())

  pauses.leave.start()

  expect(pauses.leave.isPending.value).toBe(true)

  vi.advanceTimersByTime(PAUSES.leave)

  expect(pauses.leave.isPending.value).toBe(false)
})
