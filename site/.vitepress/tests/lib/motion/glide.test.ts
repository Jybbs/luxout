/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { Glide }     from '../../../lib/motion/glide.ts'
import { DURATIONS } from '../../../lib/motion/timing.ts'

function frames(): void {
  vi.advanceTimersByTime(DURATIONS.move + 32)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
})

afterEach(() => {
  vi.useRealTimers()
})

it('eases to the goal through values between the two, and reports once it settles', () => {
  const write   = vi.fn<(value: number) => void>()
  const settled = vi.fn<() => void>()
  const glide   = new Glide(0, undefined, settled, write)
  const start   = performance.now()

  glide.ease(10)
  vi.advanceTimersToNextFrame()
  vi.advanceTimersToNextFrame()

  const [between] = write.mock.lastCall!

  expect(between).toBeLessThan(10 * (performance.now() - start) / DURATIONS.move)
  expect(between).toBeGreaterThan(0)
  expect(between).toBeLessThan(10)
  expect(settled).not.toHaveBeenCalled()

  frames()

  expect(write).toHaveBeenLastCalledWith(10)
  expect(settled).toHaveBeenCalledOnce()
})

it('holds each new goal from the moment it arrives', () => {
  const write = vi.fn<(value: number) => void>()
  const glide = new Glide(4, undefined, vi.fn<() => void>(), write)

  expect(glide.goal).toBe(4)

  glide.ease(10)

  expect(glide.goal).toBe(10)
  expect(write).not.toHaveBeenCalled()

  glide.snap(2)

  expect(glide.goal).toBe(2)
})

it('continues from where it stands when a new goal arrives partway', () => {
  const write = vi.fn<(value: number) => void>()
  const glide = new Glide(0, undefined, vi.fn<() => void>(), write)

  glide.ease(100)
  vi.advanceTimersToNextFrame()
  vi.advanceTimersToNextFrame()
  vi.advanceTimersToNextFrame()

  const [partway] = write.mock.lastCall!

  glide.ease(0)
  vi.advanceTimersToNextFrame()

  const [turned] = write.mock.lastCall!

  expect(turned).toBeGreaterThan(0)
  expect(turned).toBeLessThanOrEqual(partway)
})

it('snaps to the goal under reduced motion', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))

  const write   = vi.fn<(value: number) => void>()
  const settled = vi.fn<() => void>()
  const glide   = new Glide(0, undefined, settled, write)

  glide.ease(10)

  expect(write).toHaveBeenCalledExactlyOnceWith(10)
  expect(settled).toHaveBeenCalledOnce()
})

it('stops a motion under way when told to snap', () => {
  const write = vi.fn<(value: number) => void>()
  const glide = new Glide(0, undefined, vi.fn<() => void>(), write)

  glide.ease(10)
  glide.snap(4)
  frames()

  expect(write).toHaveBeenCalledExactlyOnceWith(4)
})

it('runs a motion over the duration it is built with', () => {
  const settled = vi.fn<() => void>()
  const glide   = new Glide(0, undefined, settled, vi.fn<(value: number) => void>(), DURATIONS.settle)

  glide.ease(10)
  frames()

  expect(settled).not.toHaveBeenCalled()

  vi.advanceTimersByTime(DURATIONS.settle)

  expect(settled).toHaveBeenCalledOnce()
})

it('eases on a move whose `eased` holds, and snaps on one whose `eased` does not', () => {
  const write = vi.fn<(value: number) => void>()
  const glide = new Glide(0, undefined, vi.fn<() => void>(), write)

  glide.move(10, true)
  expect(write).not.toHaveBeenCalled()

  frames()
  expect(write).toHaveBeenLastCalledWith(10)

  glide.move(4, false)
  expect(write).toHaveBeenLastCalledWith(4)
  expect(glide.goal).toBe(4)
})
