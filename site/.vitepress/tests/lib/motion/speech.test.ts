/** @vitest-environment happy-dom */
import { expect, vi }                                      from 'vitest'
import { type ShallowRef, defineComponent, h, shallowRef } from 'vue'

import { Speech }           from '../../../lib/motion/speech.ts'
import { PAUSES }           from '../../../lib/motion/timing.ts'
import { type Mount, test } from '../../common/mount.ts'

/**
 * A widget mounted with its speech, beside the root the speech opens its region
 * in.
 */
interface Spoken {
  readonly host   : HTMLElement
  readonly root   : ShallowRef<HTMLElement | undefined>
  readonly speech : Speech
}

function speaker(mount: Mount): Spoken {
  const root   = shallowRef<HTMLElement>()
  let speech   : Speech | undefined
  const host   = mount(defineComponent({
    setup() {
      speech = new Speech(root)

      return () => h('div', { class: 'widget', ref: root })
    }
  }))

  return { host, root, speech: speech! }
}

test('opens a polite live region inside the widget once it mounts', ({ mount }) => {
  const { host } = speaker(mount)
  const region   = host.querySelector('[aria-live]')!

  expect(region.parentElement).toBe(host.querySelector('.widget'))
  expect([region.getAttribute('aria-live'), region.getAttribute('role')]).toEqual(['polite', 'status'])
})

test('speaks only the latest words, once the speech pause has passed', ({ mount }) => {
  const { host, speech } = speaker(mount)
  const region           = host.querySelector('[aria-live]')!

  speech.say('First')
  speech.say('Second')
  vi.advanceTimersByTime(PAUSES.speech - 1)
  expect(region.textContent).toBe('')

  vi.advanceTimersByTime(1)
  expect(region.textContent).toBe('Second')
})

test(
  'cancels a pending message, removes the region, and speaks nothing once unmounted',
  ({ mount, unmount }) => {
    const { root, speech } = speaker(mount)
    const widget           = root.value!

    speech.say('Unsaid')
    unmount()
    speech.say('After')

    expect(vi.getTimerCount()).toBe(0)
    expect(widget.querySelector('[aria-live]')).toBeNull()
  }
)
