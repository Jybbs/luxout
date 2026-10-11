import DefaultTheme       from 'vitepress/theme-without-fonts'
import { expect, it, vi } from 'vitest'

import theme from '../../theme/index.ts'

vi.mock('vitepress/theme-without-fonts', () => ({ default: { Layout: 'Layout' } }))

it('serves the default theme that leaves out its bundled face', () => {
  expect(theme).toBe(DefaultTheme)
})
