import { expect, it } from 'vitest'

import { Sheet } from '../../../lib/bundle/sheet.ts'

it('lists each attribute selector naming an image once, whatever else the rule selects', () => {
  const sheet = new Sheet('a.css', [
    'img[src$="logo.svg"]:hover, .hero [src*="/sun.PNG"] { opacity: 1 }',
    'a[href$=".svg"], img[src$="logo.svg"] { color: red }',
    '[data-name="logo"], [src$="logo.svgz"] { color: blue }'
  ].join('\n'))

  expect(sheet.images).toEqual(['[src$="logo.svg"]', '[src*="/sun.PNG"]', '[href$=".svg"]'])
})

it('lists each color-mix() a declaration holds as written, nested calls included', () => {
  const sheet = new Sheet('a.css', [
    '.a { color: color-mix(in srgb, var(--a) 30%, black) }',
    '.b { background: linear-gradient(color-mix(in oklch, red, color-mix(in srgb, blue, white)), red) }',
    '.c { color: red }'
  ].join('\n'))

  expect(sheet.mixes).toEqual([
    'color-mix(in srgb, var(--a) 30%, black)',
    'color-mix(in oklch, red, color-mix(in srgb, blue, white))',
    'color-mix(in srgb, blue, white)'
  ])
})
