import { readFile } from 'node:fs/promises'

import { expect, it } from 'vitest'

import { Tokens } from '../../../lib/theme/tokens.ts'

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

it('reads no rule but the root and the dark ones', () => {
  expect(tokens.resolve('--ground', 'light')).toBe('#f2f1ee')
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
