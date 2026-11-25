/** @vitest-environment happy-dom */
import { type Mock, beforeEach, expect, vi } from 'vitest'
import { effectScope, nextTick }             from 'vue'

import { FrameClock } from '../../../../site/.vitepress/lib/motion/frame-clock.ts'
import { useMotion }  from '../../../../site/.vitepress/lib/motion/motion.ts'
import { test }       from '../../common/clock.ts'
import { stubMedia }  from '../../common/media.ts'

let disconnect : Mock<() => void>
let report     : (isIntersecting: boolean) => void

beforeEach(() => {
  disconnect = vi.fn<() => void>()
  localStorage.clear()
  stubMedia(() => false)
  vi.stubGlobal('IntersectionObserver', class {
    disconnect = disconnect
    observe    = vi.fn<() => void>()

    constructor(callback: IntersectionObserverCallback) {
      report = (isIntersecting) => callback(
        [{ isIntersecting, time: 0 } as IntersectionObserverEntry],
        this as never
      )
    }
  })
})

test('ticks once per frame while the tick returns true, and stops once it returns false', () => {
  const tick  = vi.fn<() => boolean>(() => false).mockReturnValueOnce(true)
  const clock = new FrameClock(undefined, tick)

  clock.start()
  vi.advanceTimersToNextFrame()
  vi.advanceTimersToNextFrame()
  vi.advanceTimersToNextFrame()

  expect(tick).toHaveBeenCalledTimes(2)
})

test('requests one frame however often it starts or the element returns to the screen', async () => {
  const tick  = vi.fn<() => boolean>(() => true)
  const clock = new FrameClock(document.createElement('div'), tick)

  clock.start()
  clock.start()
  report(false)
  await nextTick()
  report(true)
  await nextTick()
  vi.advanceTimersToNextFrame()

  expect(tick).toHaveBeenCalledOnce()
})

test('requests no frame while the watched element is off screen, and resumes once it returns', async () => {
  const tick  = vi.fn<() => boolean>(() => true)
  const clock = new FrameClock(document.createElement('div'), tick)

  report(false)
  clock.start()
  vi.advanceTimersToNextFrame()
  expect(tick).not.toHaveBeenCalled()

  report(true)
  await nextTick()
  vi.advanceTimersToNextFrame()
  expect(tick).toHaveBeenCalledOnce()
})

test('stops ticking and disconnects the observer once its scope stops', () => {
  const tick  = vi.fn<() => boolean>(() => true)
  const scope = effectScope()
  const clock = scope.run(() => new FrameClock(document.createElement('div'), tick))!

  clock.start()
  scope.stop()
  vi.advanceTimersToNextFrame()

  expect(tick).not.toHaveBeenCalled()
  expect(disconnect).toHaveBeenCalledOnce()
})

test('cancels the frame it requested when stopped', () => {
  const tick  = vi.fn<() => boolean>(() => true)
  const clock = new FrameClock(undefined, tick)

  clock.start()
  clock.stop()
  vi.advanceTimersToNextFrame()

  expect(tick).not.toHaveBeenCalled()
})

test('requests no frame while the drawings are paused, and resumes once they run', async () => {
  const tick  = vi.fn<() => boolean>(() => true)
  const clock = new FrameClock(undefined, tick)

  useMotion().set(true)
  await nextTick()
  clock.start()
  vi.advanceTimersToNextFrame()
  expect(tick).not.toHaveBeenCalled()

  useMotion().set(false)
  await nextTick()
  vi.advanceTimersToNextFrame()
  expect(tick).toHaveBeenCalledOnce()
})

test('leaves out of its time every span the drawings spent paused', async () => {
  const times: number[] = []
  const clock           = new FrameClock(undefined, (now) => times.push(now) > 0)

  clock.start()
  vi.advanceTimersToNextFrame()
  useMotion().set(true)
  await nextTick()

  const held = clock.now()

  vi.advanceTimersByTime(5000)
  expect(clock.now()).toBe(held)

  useMotion().set(false)
  await nextTick()
  vi.advanceTimersToNextFrame()

  expect(times[1]! - times[0]!).toBeLessThan(100)
})
