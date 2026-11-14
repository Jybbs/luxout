/** @vitest-environment happy-dom */
import { fireEvent, getByRole } from '@testing-library/dom'
import { expect }               from 'vitest'
import { nextTick }             from 'vue'

import { PauseSwitch } from '../../../theme/controls/pause-switch.tsx'
import { stubMedia }   from '../../common/media.ts'
import { test }        from '../../common/mount.ts'

test('reads as a switch, unchecked while the drawings run', ({ mount }) => {
  stubMedia(() => false)

  const control = getByRole(mount(PauseSwitch), 'switch', { name: 'Pause drawings' })

  expect(control.localName).toBe('button')
  expect(control.getAttribute('aria-checked')).toBe('false')
})

test('starts checked for a reader who prefers reduced motion', ({ mount }) => {
  stubMedia(() => true)

  expect(getByRole(mount(PauseSwitch), 'switch').getAttribute('aria-checked')).toBe('true')
})

test('flips the paused state on each press and keeps the choice', async ({ mount }) => {
  stubMedia(() => false)

  const control = getByRole(mount(PauseSwitch), 'switch')

  fireEvent.click(control)
  await nextTick()
  expect(control.getAttribute('aria-checked')).toBe('true')
  expect(localStorage.getItem('luxout-paused')).toBe('true')

  fireEvent.click(control)
  await nextTick()
  expect(control.getAttribute('aria-checked')).toBe('false')
  expect(localStorage.getItem('luxout-paused')).toBe('false')
})
