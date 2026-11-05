/** @vitest-environment happy-dom */
import { expect, it, vi } from 'vitest'

import * as timing from '../../../lib/motion/timing.ts'

function preference(matches: boolean): { flip: () => void } {
  const media = new EventTarget() as MediaQueryList

  Object.defineProperty(media, 'matches', { get: () => matches })
  vi.stubGlobal('matchMedia', () => media)

  return {
    flip() {
      matches = !matches
      media.dispatchEvent(new Event('change'))
    }
  }
}

it('writes each duration and the easing onto the element', () => {
  const root = document.createElement('div')

  preference(false)
  timing.writeTiming(root)

  expect(root.style.getPropertyValue('--timing-settle')).toBe(`${timing.DURATIONS.settle}ms`)
  expect(root.style.getPropertyValue('--timing-ease')).toBe('cubic-bezier(0.333, 0, 0.667, 1)')
})

it('sets every duration to a millisecond under reduced motion, and follows a change', () => {
  const root     = document.createElement('div')
  const { flip } = preference(true)

  timing.writeTiming(root)
  expect(root.style.getPropertyValue('--timing-fade')).toBe('1ms')

  flip()
  expect(root.style.getPropertyValue('--timing-fade')).toBe(`${timing.DURATIONS.fade}ms`)
})

it('reports the reader’s preference', () => {
  preference(true)

  expect(timing.motionReduced()).toBe(true)
})

it('keeps a pause out of the durations reduced motion shortens', () => {
  expect(Object.keys(timing.PAUSES).filter((name) => name in timing.DURATIONS)).toEqual([])
})

it.each([
  { expected: 0, place: -1 },
  { expected: 0, place: 0 },
  { expected: 0.15625, place: 0.25 },
  { expected: 0.5, place: 0.5 },
  { expected: 1, place: 1 },
  { expected: 1, place: 2 }
])('eases $place along smoothstep to $expected', ({ expected, place }) => {
  expect(timing.smoothstep(place)).toBe(expected)
})
