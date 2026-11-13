/** @vitest-environment happy-dom */
import { expect, vi }                        from 'vitest'
import { type VNode, effectScope, nextTick } from 'vue'

import { PAUSES }    from '../../../lib/motion/timing.ts'
import { Announcer } from '../../../theme/controls/announcer.tsx'
import { test }      from '../../common/mount.ts'

test('speaks only the latest words, once the speech pause has passed', async ({ mount }) => {
  const announcer = new Announcer()
  const region    = mount(() => announcer.region).querySelector('[aria-live=polite]')!

  announcer.say('First')
  announcer.say('Second')
  vi.advanceTimersByTime(PAUSES.speech - 1)
  await nextTick()
  expect(region.textContent).toBe('')

  vi.advanceTimersByTime(1)
  await nextTick()
  expect(region.textContent).toBe('Second')
})

test('renders the new words without rendering what holds the region again', async ({ mount }) => {
  const announcer = new Announcer()
  const render    = vi.fn<() => VNode>(() => announcer.region)
  const region    = mount(render).querySelector('[aria-live=polite]')!

  announcer.say('Spoken')
  vi.advanceTimersByTime(PAUSES.speech)
  await nextTick()

  expect(region.textContent).toBe('Spoken')
  expect(render).toHaveBeenCalledOnce()
})

test('speaks nothing once its scope stops', async ({ mount }) => {
  const scope     = effectScope()
  const announcer = scope.run(() => new Announcer())!
  const region    = mount(() => announcer.region).querySelector('[aria-live=polite]')!

  announcer.say('Unsaid')
  scope.stop()
  vi.advanceTimersByTime(PAUSES.speech)
  await nextTick()

  expect(region.textContent).toBe('')
})
