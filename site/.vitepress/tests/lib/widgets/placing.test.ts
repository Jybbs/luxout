import { join } from 'node:path'

import { createMarkdownRenderer } from 'vitepress'
import { expect, it }             from 'vitest'

import config           from '../../../config.ts'
import { placeWidgets } from '../../../lib/widgets/placing.ts'

const BASE = { fold: 'As a table', heading: 'The Section', widget: 'TheGap' } as const
const BODY = '# Page\n\n## The Section\n\nThe words.\n\n![Frame](./frame.svg)\n\n'
           + '| A |\n|---|\n| b |\n\nAfter.\n\n## Next\n\nNext.\n'
const NO_TABLE = '## The Section\n\nWords.\n\n## Next\n\n| A |\n|---|\n| b |\n'
const md = await createMarkdownRenderer(join(import.meta.dirname, '..', '..', '..', '..'), config.markdown)

placeWidgets(md, [
  { ...BASE, page: 'plain.md' },
  { ...BASE, page: 'words.md', words: true },
  { ...BASE, frame: './frame.svg', page: 'frame.md' },
  { ...BASE, heading: 'Gone', page: 'renamed.md' },
  { ...BASE, page: 'tableless.md' },
  { ...BASE, frame: './gone.svg', page: 'frameless.md' }
])

function render(relativePath: string, source = BODY): string {
  return md.render(source, { relativePath })
}

it('sets the widget ahead of the table folded shut beneath it', () => {
  const html = render('plain.md')

  expect(html).toMatch(/<\/h2>\s*<p>The words\.<\/p>/)
  expect(html).toMatch(/<TheGap \/><TableFold summary="As a table">.*<table.*<\/table>.*<\/TableFold>/s)
})

it('moves the section’s words into the widget ahead of the table', () => {
  expect(render('words.md')).toMatch(/<TheGap><p>The words\.<\/p>.*<\/TheGap><TableFold/s)
})

it('removes the frame the widget opens on', () => {
  expect(render('frame.md')).not.toContain('frame.svg')
})

it('leaves the rest of the page where it stands', () => {
  expect(render('plain.md')).toMatch(/<\/TableFold>\s*<p>After\.<\/p>/)
})

it('leaves every other page alone', () => {
  expect(render('other.md')).not.toContain('TheGap')
})

it.each([
  {
    message : 'renamed.md holds no heading "Gone"',
    name    : 'a heading the page has renamed',
    page    : 'renamed.md',
    source  : BODY
  },
  {
    message : 'tableless.md holds no table under the heading "The Section"',
    name    : 'a section with no table',
    page    : 'tableless.md',
    source  : NO_TABLE
  },
  {
    message : 'frameless.md holds no frame ./gone.svg under the heading "The Section"',
    name    : 'a frame the section does not hold',
    page    : 'frameless.md',
    source  : BODY
  }
])('fails the build on $name', ({ message, page, source }) => {
  expect(() => render(page, source)).toThrow(message)
})
