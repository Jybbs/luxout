/** @vitest-environment happy-dom */
import { fireEvent, getByRole }                     from '@testing-library/dom'
import { expect, vi }                               from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'

import { Disclosure }       from '../../../theme/controls/disclosure.tsx'
import { type Mount, test } from '../../common/mount.ts'

function disclosed(mount: Mount): HTMLElement {
  return mount(defineComponent({
    setup() {
      const open       = shallowRef(false)
      const disclosure = new Disclosure('more-region', open, () => {
        open.value = !open.value
      })

      return () => h('div', [disclosure.button('More', 'ml-auto'), h('div', { id: 'more-region' })])
    }
  }))
}

test('points the button at the region it opens, closed at first', ({ mount }) => {
  const button = getByRole(disclosed(mount), 'button', { name: 'More' })

  expect(button.getAttribute('aria-controls')).toBe('more-region')
  expect(button.getAttribute('aria-expanded')).toBe('false')
  expect(button.classList.contains('ml-auto')).toBe(true)
})

test('opens the region on a press and closes it on the next', async ({ mount }) => {
  const button = getByRole(disclosed(mount), 'button', { name: 'More' })

  fireEvent.click(button)
  await nextTick()

  expect([button.getAttribute('aria-expanded'), button.dataset.state]).toEqual(['true', 'open'])

  fireEvent.click(button)
  await nextTick()
  vi.advanceTimersToNextFrame()
  await nextTick()

  expect([button.getAttribute('aria-expanded'), button.dataset.state]).toEqual(['false', 'closed'])
})
