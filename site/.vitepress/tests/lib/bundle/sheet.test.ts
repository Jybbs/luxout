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

it('lists each top-level cascade layer in the order the stylesheet first names it', () => {
  const sheet = new Sheet('a.css', [
    '@layer vitepress { @layer __vitepress_base { a { color: red } } }',
    '@layer theme, base;',
    '@layer vitepress, utilities;'
  ].join('\n'))

  expect(sheet.layers).toEqual(['vitepress', 'theme', 'base', 'utilities'])
})

it('lists each color property a rule sets to a bare number, leaving a color and a length', () => {
  const sheet = new Sheet('a.css', [
    '.a { color: 0; font-size: 0 }',
    '.b { border-top-color: -1.5; fill: 2; stroke-width: 2 }',
    '.c { color: red; background-color: #000; stroke: var(--a) }'
  ].join('\n'))

  expect(sheet.uncolored).toEqual(['.a { color: 0 }', '.b { border-top-color: -1.5 }', '.b { fill: 2 }'])
})

it('lists each property a rule sets outside every layer once, at any depth beneath other at-rules', () => {
  const sheet = new Sheet('a.css', [
    ':root { --a: red; --b: blue }',
    '@supports (color: red) { :root { --a: red } }',
    '@layer base { @media (hover: hover) { a { color: red } } }',
    '@keyframes turn { to { rotate: 1turn } }'
  ].join('\n'))

  expect(sheet.unlayered).toEqual([':root { --a }', ':root { --b }'])
})

it('copies the stylesheet without the blocks of one layer, leaving every other', () => {
  const sheet = new Sheet('a.css', [
    '@layer vitepress { a { color: color-mix(in srgb, red, black) } }',
    '@layer utilities { b { color: color-mix(in srgb, blue, white) } }'
  ].join('\n'))

  expect(sheet.outside('vitepress').mixes).toEqual(['color-mix(in srgb, blue, white)'])
  expect(sheet.mixes).toHaveLength(2)
})

it('lists each value the theme gives a namespace, leaving out the reset', () => {
  const sheet = new Sheet(
    'a.css',
    '@theme { --container-*: initial; --container-sm: 30rem; --breakpoint-sm: 40rem }'
  )

  expect(sheet.theme('container')).toEqual(['30rem'])
})

it('lists each width a query of one kind names, whichever way the query writes it', () => {
  const sheet = new Sheet('a.css', [
    '@container not (width>=38rem) { a { color: red } }',
    '@container (min-width: 30rem) and (max-width: 40rem) { a { color: red } }',
    '@media (width >= 48rem) { a { color: red } }',
    '@media (min-width: 60rem) and (max-height: 20rem) { a { color: red } }',
    '@media (hover: hover) { a { color: red } }'
  ].join('\n'))

  expect([sheet.widths('container'), sheet.widths('media')])
    .toEqual([['38rem', '30rem', '40rem'], ['48rem', '60rem']])
})
