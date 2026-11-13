import { readFile } from 'node:fs/promises'

import { expect, it } from 'vitest'

import { DARK, SCHEMES, Tokens } from '../../../lib/theme/tokens.ts'

const sheet = [
  '.a { fill: var(--link) }',
  `@media ${DARK} { .a { fill: red } }`,
  '@media (width > 0) { .b { fill: blue } }'
].join('\n')
const tokens = Tokens.parse(await readFile(new URL('fixtures/tokens.css', import.meta.url), 'utf8'))

it('follows every var() a property names to the value it ends on', () => {
  expect(tokens.resolve('--link', 'light')).toBe('#1a1a1a')
})

it('takes what the dark rule declares over the root rule in the dark scheme', () => {
  expect([tokens.resolve('--link', 'dark'), tokens.resolve('--link', 'light')])
    .toEqual(['#f2f1ee', '#1a1a1a'])
})

it('keeps a root property the dark rule leaves alone in the dark scheme', () => {
  expect(tokens.resolve('--ground', 'dark')).toBe('#f2f1ee')
})

it('reads no rule but the theme block, the root rule, and the dark rule', () => {
  expect(tokens.resolve('--ground', 'light')).toBe('#f2f1ee')
})

it('reads the theme block in each scheme, beneath the root and the dark rules', () => {
  expect([tokens.resolve('--ground', 'light'), tokens.resolve('--wash', 'dark')])
    .toEqual(['#f2f1ee', 'color-mix(in srgb, var(--ink) 25%, var(--ground))'])
})

it('mixes a color-mix() of two properties in sRGB as each scheme resolves them', () => {
  expect([tokens.color('--wash', 'light'), tokens.color('--wash', 'dark')]).toEqual(['#bcbbb9', '#f2f1ee'])
})

it('mixes a color-mix() nested in another in the space the outer call names', () => {
  expect(tokens.color('--edge', 'light')).toBe('#656464')
})

it('reads a color holding no color-mix() as its hex code', () => {
  expect(tokens.color('--link', 'dark')).toBe('#f2f1ee')
})

it('follows a var() value to the value the property it names ends on', () => {
  expect(tokens.follow('var(--link)', 'dark')).toBe('#f2f1ee')
})

it('keeps a value that names no property as written', () => {
  expect(tokens.follow('1px solid', 'light')).toBe('1px solid')
})

it('names the property and the scheme that declare nothing', () => {
  expect(() => tokens.resolve('--sky', 'dark')).toThrow('The tokens declare no --sky in the dark scheme')
})

it.for(SCHEMES)('writes the sheet as the %s scheme applies it', (scheme) => {
  expect(tokens.flatten(sheet, scheme)).toMatchSnapshot()
})
