import { join } from 'node:path'

import { expect, it } from 'vitest'

import { buildNavigation } from '../../../lib/config/navigation.ts'
import { sectionPages }    from '../../../lib/config/pages.ts'
import { SECTIONS }        from '../../../lib/config/sections.ts'

const site       = join(import.meta.dirname, '..', '..', '..', '..')
const navigation = buildNavigation(site, SECTIONS)

it('links each section from the navigation bar, active on every page beneath its route', () => {
  expect(navigation.nav).toEqual(SECTIONS.map(({ label, slug }) => ({
    activeMatch : `^/${slug}/`,
    link        : `/${slug}/`,
    text        : label
  })))
})

it('opens each sidebar on its overview and lists the section’s pages beneath it', () => {
  expect(navigation.sidebar).toEqual(Object.fromEntries(SECTIONS.map((section) => {
    const link = `/${section.slug}/`

    return [link, [{ link, text: section.label }, ...sectionPages(site, section)]]
  })))
})

it('keeps the Install sidebar in document order', () => {
  const links = ['/install/', '/install/installing', '/install/place', '/install/home']

  expect(navigation.sidebar).toMatchObject({ '/install/': links.map((link) => ({ link })) })
})
