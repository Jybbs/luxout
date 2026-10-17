import { join } from 'node:path'

import { createMarkdownRenderer } from 'vitepress'
import { expect, it }             from 'vitest'

import config from '../../../config.ts'

const md = await createMarkdownRenderer(join(import.meta.dirname, '..', '..', '..', '..'), config.markdown)

it('names a note, its marker, and its back link for the key the marker cites', () => {
  expect(md.render('Bright[^reda2008].\n\n[^reda2008]: Reda and Andreas.\n')).toMatchSnapshot()
})

it('keeps a note’s anchor where the page cites another work above it', () => {
  expect(md.render('One[^reno2012], two[^reda2008].\n\n[^reno2012]: Reno.\n\n[^reda2008]: Reda.\n'))
    .toContain('<li id="footnote-reda2008" class="footnote-item">')
})

it('numbers a second citation of one work after a colon, its marker and back link named for the key', () => {
  expect(md.render('One[^reda2008], again[^reda2008].\n\n[^reda2008]: Reda.\n')).toMatchSnapshot()
})

it('numbers a note written inline, which names no key', () => {
  expect(md.render('Bright^[An aside.].\n')).toContain('<li id="footnote1" class="footnote-item">')
})

it('escapes a key holding the quote an attribute ends on', () => {
  expect(md.render('Bright[^a"b].\n\n[^a"b]: A.\n'))
    .toContain('<li id="footnote-a&quot;b" class="footnote-item">')
})
