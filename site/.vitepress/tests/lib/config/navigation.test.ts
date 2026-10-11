import { expect, it } from 'vitest'

import { buildNavigation } from '../../../lib/config/navigation.ts'

const SAMPLE = [{ label: 'Sensors', slug: 'sensors' }, { label: 'Setup', slug: 'setup' }]

it('links each section from the navigation bar, active on every page beneath its route', () => {
  expect(buildNavigation(SAMPLE).nav).toEqual([
    { activeMatch: '^/sensors/', link: '/sensors/', text: 'Sensors' },
    { activeMatch: '^/setup/', link: '/setup/', text: 'Setup' }
  ])
})

it('keys one sidebar per section by the route the navigation bar links', () => {
  expect(buildNavigation(SAMPLE).sidebar).toEqual({
    '/sensors/' : [{ link: '/sensors/', text: 'Sensors' }],
    '/setup/'   : [{ link: '/setup/', text: 'Setup' }]
  })
})
