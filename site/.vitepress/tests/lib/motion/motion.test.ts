/** @vitest-environment happy-dom */
import { beforeEach, expect, it } from 'vitest'
import { nextTick }               from 'vue'

import { useMotion, writePaused } from '../../../lib/motion/motion.ts'
import { stubMedia }              from '../../common/media.ts'

beforeEach(() => {
  localStorage.clear()
  stubMedia(() => false)
})

it('runs the drawings for a reader who has neither chosen nor asked for reduced motion', () => {
  expect(useMotion().paused.value).toBe(false)
})

it('pauses the drawings by default for a reader who prefers reduced motion', () => {
  stubMedia((query) => query.includes('reduce'))

  expect(useMotion().paused.value).toBe(true)
})

it.each([true, false])('keeps a reader’s choice of %s across pages and visits', async (paused) => {
  useMotion().set(paused)
  await nextTick()

  expect(localStorage.getItem('luxout-paused')).toBe(String(paused))
  expect(useMotion().paused.value).toBe(paused)
})

it('holds a reader’s choice to run the drawings over their preference for reduced motion', () => {
  stubMedia(() => true)
  localStorage.setItem('luxout-paused', 'false')

  expect(useMotion().paused.value).toBe(false)
})

it('brings every drawing already on the page to the choice the switch sets', async () => {
  const drawing = useMotion()

  useMotion().set(true)
  await nextTick()

  expect(drawing.paused.value).toBe(true)
})

it('marks the root element while the drawings are paused, and clears the mark once they run', async () => {
  const root = document.createElement('html')

  writePaused(root)
  expect(root.hasAttribute('data-paused')).toBe(false)

  useMotion().set(true)
  await nextTick()
  expect(root.hasAttribute('data-paused')).toBe(true)

  useMotion().set(false)
  await nextTick()
  expect(root.hasAttribute('data-paused')).toBe(false)
})
