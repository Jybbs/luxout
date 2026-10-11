import type { DefaultTheme } from 'vitepress'

import type { Section } from './sections.ts'

export function buildNavigation(sections: readonly Section[]): Pick<DefaultTheme.Config, 'nav' | 'sidebar'> {
  const links = sections.map(({ label, slug }) => ({ link: `/${slug}/`, text: label }))

  return {
    nav     : links.map(({ link, text }) => ({ activeMatch: `^${link}`, link, text })),
    sidebar : Object.fromEntries(links.map((item) => [item.link, [item]]))
  }
}
