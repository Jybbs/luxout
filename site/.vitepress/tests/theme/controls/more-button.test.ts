/** @vitest-environment happy-dom */
import { fireEvent, getByRole } from '@testing-library/dom'
import { expect, vi }           from 'vitest'

import { moreButton } from '../../../theme/controls/more-button.tsx'
import { test }       from '../../common/mount.ts'

test('names the region it controls and whether that region is open', ({ mount }) => {
  const button = getByRole(mount(() => moreButton('region', 'How', true, vi.fn())), 'button', { name: 'How' })

  expect(button.getAttribute('aria-controls')).toBe('region')
  expect(button.getAttribute('aria-expanded')).toBe('true')
})

test('calls `toggle` on a click', ({ mount }) => {
  const toggle = vi.fn<() => void>()
  const button = getByRole(mount(() => moreButton('region', 'How', false, toggle)), 'button')

  fireEvent.click(button)

  expect(button.getAttribute('aria-expanded')).toBe('false')
  expect(toggle).toHaveBeenCalledOnce()
})
