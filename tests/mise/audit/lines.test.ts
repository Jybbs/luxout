import { fc, test }   from '@fast-check/vitest'
import { expect, it } from 'vitest'

import { LineBudget } from '../../../.mise/audit/lines.ts'

const lines = (text: string): (number | string)[][] =>
  new LineBudget({ 'src/a.ts': text }).findings.map(({ message, spot, title }) => [spot.line, title, message])

it('reports each line past 110 characters on its own line number, counted in characters', () => {
  expect(lines(`${'a'.repeat(110)}\n${'b'.repeat(111)}\n\n${'’'.repeat(116)}\n`)).toEqual([
    [2, 'Line length', 'The line runs 111 characters, past the 110-character budget'],
    [4, 'Line length', 'The line runs 116 characters, past the 110-character budget']
  ])
})

it.each([
  { name: 'a typographic apostrophe', row: `'${'’'.repeat(108)}'` },
  { name: 'an emoji outside the basic plane', row: `'${'🦖'.repeat(108)}'` },
  { name: 'a letter and its combining accent', row: `'${'e\u0301'.repeat(108)}'` }
])('counts $name as one character', ({ row }) => {
  expect(lines(row)).toEqual([])
})

it.each([
  { name: 'a regular expression', row: `    /^${'a\\/'.repeat(40)}$/u` },
  { name: 'a regular expression ending its argument', row: `      /^${'a\\.'.repeat(40)}$/,` },
  { name: 'a regular expression with no flag after it', row: `      /^${'a\\.b\\n'.repeat(20)}/` },
  { name: 'a regular expression with a slash in a class', row: `  /^(?:[^/]+\\/){3}${'a'.repeat(100)}$/,` },
  { name: 'a regular expression ending a statement', row: `  /^${'a\\.'.repeat(40)}$/;` },
  { name: 'a glob', row: `  '${'src/**/'.repeat(20)}*.{ts,tsx}',` },
  { name: 'a glob in double quotes ending a call', row: `  "${'a?b/'.repeat(30)}c")` },
  { name: 'a glob in a template literal', row: `  \`${'a*/'.repeat(40)}\`,` },
  { name: 'a glob of braces alone', row: `  '${'src/{a,b}/'.repeat(12)}index.ts',` }
])('leaves out a row holding nothing but $name', ({ row }) => {
  expect(lines(row)).toEqual([])
})

it.each([
  { name: 'a regular expression a binding opens', row: `const PATTERN = /^${'a'.repeat(100)}$/` },
  { name: 'a regular expression a call follows', row: `/^${'a'.repeat(110)}$/.test(row)` },
  { name: 'a block comment', row: `/* ${'a'.repeat(110)} */` },
  { name: 'a line comment holding slashes', row: `// a/${'b'.repeat(110)}/` },
  { name: 'a string holding a space beside its asterisk', row: `'${'a '.repeat(55)}*'` },
  { name: 'a URL holding a query', row: `  'https://example.com/${'a'.repeat(100)}?b=c',` },
  { name: 'a template literal holding a substitution', row: `  \`\${root}/${'a/'.repeat(55)}*\`,` },
  { name: 'a path holding a placeholder in braces', row: `  'repos/{owner}/{repo}/${'a'.repeat(100)}',` },
  { name: 'a string with no glob character', row: `'${'a/'.repeat(60)}'` }
])('reports a row holding $name past the budget', ({ row }) => {
  expect(lines(row)).toHaveLength(1)
})

test.prop([fc.string({ maxLength: 110, unit: 'binary' })])('passes any text within the budget', (text) => {
  expect(lines(text)).toEqual([])
})

it('reports each line under the file holding it', () => {
  const long     = 'a'.repeat(111)
  const findings = new LineBudget({ 'site/b.tsx': `\n${long}`, 'src/a.ts': long }).findings

  expect(findings.map(({ spot }) => spot)).toEqual([
    { file: 'site/b.tsx', line: 2 },
    { file: 'src/a.ts', line: 1 }
  ])
})
