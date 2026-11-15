import type { DefaultTheme } from 'vitepress'

import { sectionPages } from './pages.ts'
import type { Section } from './sections.ts'

/**
 * Builds the nav bar, one sidebar per section, each sidebar opening on the
 * section's overview and listing its pages, and the footer linking the
 * identity page, which no section holds.
 */
export function buildNavigation(
  root     : string,
  sections : readonly Section[]
): Pick<DefaultTheme.Config, 'footer' | 'nav' | 'sidebar'> {
  return {
    footer: { message: '<a href="/identity">Identity</a>' },
    nav: sections.map(({ label, slug }) => ({ activeMatch: `^/${slug}/`, link: `/${slug}/`, text: label })),
    sidebar: Object.fromEntries(sections.map((section) => {
      const link = `/${section.slug}/`

      return [link, [{ link, text: section.label }, ...sectionPages(root, section)]]
    }))
  }
}
