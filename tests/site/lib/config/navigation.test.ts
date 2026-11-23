import { access } from 'node:fs/promises'
import { join }   from 'node:path'

import { expect, it } from 'vitest'

import { buildNavigation } from '../../../../site/.vitepress/lib/config/navigation.ts'
import { sectionPages }    from '../../../../site/.vitepress/lib/config/pages.ts'
import { SECTIONS }        from '../../../../site/.vitepress/lib/config/sections.ts'

const site       = join(import.meta.dirname, '..', '..', '..', '..', 'site')
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

it('links the identity page, which no section holds, from the footer', async () => {
  const href = /href="\/([\w-]+)"/.exec(navigation.footer!.message!)![1]!

  expect(SECTIONS.map(({ slug }) => slug)).not.toContain(href)
  await expect(access(join(site, `${href}.md`))).resolves.toBeUndefined()
})
