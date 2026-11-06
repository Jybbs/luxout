import type { DefaultTheme } from 'vitepress'

import { sectionPages } from './pages.ts'
import type { Section } from './sections.ts'

/**
 * Builds the nav bar and one sidebar per section, each sidebar opening on the
 * section's overview and listing its pages.
 */
export function buildNavigation(
  root     : string,
  sections : readonly Section[]
): Pick<DefaultTheme.Config, 'nav' | 'sidebar'> {
  return {
    nav: sections.map(({ label, slug }) => ({ activeMatch: `^/${slug}/`, link: `/${slug}/`, text: label })),
    sidebar: Object.fromEntries(sections.map((section) => {
      const link = `/${section.slug}/`

      return [link, [{ link, text: section.label }, ...sectionPages(root, section)]]
    }))
  }
}
