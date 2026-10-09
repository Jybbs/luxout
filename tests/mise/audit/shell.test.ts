import { expect, it } from 'vitest'

import { scan } from '../../../.mise/audit/shell.ts'

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
    script   : 'if CI=1 bun install; then\n  until ! cmp -s a b; do { mise lock; }; done\nfi\necho done CI=1',
    expected : [
      { line: 1, words: ['bun', 'install'] },
      { line: 2, words: ['cmp', '-s', 'a', 'b'] },
      { line: 2, words: ['mise', 'lock'] },
      { line: 4, words: ['echo', 'done', 'CI=1'] }
    ]
  },
  {
    expected : [{ line: 1, words: ['echo', 'bun install', 'a "b" $c', 'd e', 'a#b'] }],
    name     : 'removes quotes and escapes from each word',
    script   : 'echo \'bun install\' "a \\"b\\" $c" d\\ e a#b'
  },
  {
    expected : [{ line: 1, words: ['bun', 'install'] }],
    name     : 'leaves each redirection out of the words',
    script   : 'bun install 2>&1 &>/dev/null'
  },
  {
    expected : [{ line: 2, words: ['bun', 'install'] }],
    name     : 'reads the commands a function body runs',
    script   : 'function bake {\n  bun install\n}'
  },
  {
    expected : [{ line: 1, words: ['cat'] }],
    name     : 'reads a heredoc as the text it feeds rather than as commands',
    script   : 'cat <<EOF\nbun install\nEOF\n'
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
    expected : [{ line: 1, words: ['cat'] }, { line: 2, words: ['bun', 'install'] }],
    name     : 'reads the command a substitution runs inside an unquoted heredoc',
    script   : 'cat <<EOF\n$(bun install)\nEOF\n'
  },
  {
    name     : 'reads the command a substitution runs inside a quote, an expansion, or a process',
    script   : 'echo "$(bun i)" ${x:-$(bun i)} <(bun i)',
    expected : [
      { line: 1, words: ['echo', '$(bun i)', '${x:-$(bun i)}', '<(bun i)'] },
      { line: 1, words: ['bun', 'i'] },
      { line: 1, words: ['bun', 'i'] },
      { line: 1, words: ['bun', 'i'] }
    ]
  },
  {
    expected : [{ line: 2, words: ['echo', '$y'] }, { line: 2, words: ['bun', 'install'] }],
    name     : 'counts lines in a backtick substitution that holds an escape from the line it opens on',
    script   : '# a long first line\nx=`echo \\$y; bun install`'
  },
  {
    expected : [{ line: 1, words: ['echo', 'a b'] }, { line: 2, words: ['bun', 'install'] }],
    name     : 'drops a backslash-newline inside double quotes, as a continuation',
    script   : 'echo "a \\\nb" && bun install'
  },
  {
    expected : [{ line: 1, words: ['echo', 'one\ntwo'] }, { line: 3, words: ['last'] }],
    name     : 'counts the lines a quoted word spans',
    script   : 'echo "one\ntwo"\nlast'
  }
])('$name', ({ expected, script }) => {
  expect(scan(script).invocations).toEqual(expected)
})

it('numbers each command from the line its script starts on', () => {
  expect(scan('one\ntwo', 10).invocations)
    .toEqual([{ line: 10, words: ['one'] }, { line: 11, words: ['two'] }])
})

it.each([
  { expected: [{ line: 1, message: "unexpected token '('" }], script: 'cd {{arg(name="dir")}}\nbun install' },
  {
    expected : [{ line: 3, message: "expected 'esac' to close 'case'" }],
    script   : 'case $x in\n  a) echo ;;\nbun install'
  },
  {
    expected : [{ line: 2, message: 'unterminated command substitution' }],
    script   : 'x=1\ny=`echo \\$y; echo $(`'
  }
])('reports each error the parser meets in $script', ({ expected, script }) => {
  expect(scan(script).errors).toEqual(expected)
})
