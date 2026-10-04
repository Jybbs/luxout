import { expect, it } from 'vitest'

import { commands } from '../../../.mise/audit/shell.ts'

it.each([
  {
    expected : [{ line: 4, words: ['bun', 'install'] }],
    name     : 'skips the shebang, the frontmatter, and every comment',
    script   : '#!/usr/bin/env -S bash -euo pipefail\n#MISE alias = "bake"\n\nbun install  # frozen below\n'
  },
  {
    name     : 'splits commands at each operator and newline',
    script   : 'a && b || c | d; e & f\ng',
    expected : [
      { line: 1, words: ['a'] },
      { line: 1, words: ['b'] },
      { line: 1, words: ['c'] },
      { line: 1, words: ['d'] },
      { line: 1, words: ['e'] },
      { line: 1, words: ['f'] },
      { line: 2, words: ['g'] }
    ]
  },
  {
    name     : 'skips each reserved word and assignment ahead of a program',
    script   : 'if CI=1 bun install; then\n  until ! cmp -s a b; do { mise lock; }; done\nfi',
    expected : [
      { line: 1, words: ['bun', 'install'] },
      { line: 2, words: ['cmp', '-s', 'a', 'b'] },
      { line: 2, words: ['mise', 'lock'] }
    ]
  },
  {
    expected : [{ line: 1, words: ['echo', 'bun install', 'a "b" $c', 'd e', 'a#b'] }],
    name     : 'removes quotes and escapes from each word',
    script   : 'echo \'bun install\' "a \\"b\\" $c" d\\ e a#b'
  },
  {
    expected : [{ line: 1, words: ['bun', 'install', '2>&1', '&>/dev/null'] }],
    name     : 'keeps a redirection to a descriptor inside its word',
    script   : 'bun install 2>&1 &>/dev/null'
  },
  {
    expected : [{ line: 1, words: ['bun', 'install', '--frozen-lockfile'] }, { line: 3, words: ['next'] }],
    name     : 'joins a line its backslash continues',
    script   : 'bun install \\\n  --frozen-lockfile\nnext'
  },
  {
    expected : [{ line: 1, words: ['bun', 'install'] }],
    name     : 'reads the command a substitution runs',
    script   : 'snapshot=$(bun install)'
  },
  {
    expected : [{ line: 1, words: ['echo', 'one\ntwo'] }, { line: 3, words: ['last'] }],
    name     : 'counts the lines a quoted word spans',
    script   : 'echo "one\ntwo"\nlast'
  }
])('$name', ({ expected, script }) => {
  expect(commands(script).toArray()).toEqual(expected)
})

it('numbers each command from the line its script starts on', () => {
  expect(commands('one\ntwo', 10).toArray())
    .toEqual([{ line: 10, words: ['one'] }, { line: 11, words: ['two'] }])
})
