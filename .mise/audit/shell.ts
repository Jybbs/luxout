/**
 * A simple command a script runs, with the line it starts on and its words
 * after quote removal.
 */
export interface Command {
  line  : number
  words : string[]
}

const ASSIGNMENT = /^[A-Za-z_]\w*=/
const ESCAPED    = /\\([$`"\\\n])/g
const QUOTED     = /'([^']*)'|"((?:[^"\\]|\\.)*)"|\\(.)/gs
const RESERVED   = new Set([
  '!', 'do', 'done', 'elif', 'else', 'esac', 'fi', 'if', 'then', 'time', 'until', 'while', '{', '}'
])
const TOKENS = /[ \t]+|\\\n|#.*|(?<word>(?:[<>]&|&>|[^\s;&|()`'"\\]|\\.|'[^']*'|"(?:[^"\\]|\\.)*")+)|(?<operator>[\s\S])/g

/**
 * Splits `script` into the simple commands it runs, skipping each comment and
 * each reserved word and assignment ahead of a command's program.
 *
 * Args:
 *   script : A task's shell script, a whole task file or one entry of a TOML
 *     task's `run`.
 *   line   : The line of its file that `script` starts on.
 */
export function* commands(script: string, line = 1): Generator<Command> {
  let start           = line
  let words: string[] = []

  for (const { 0: token, groups: { operator, word } = {} } of script.matchAll(TOKENS)) {
    if (word !== undefined && (words.length > 0 || !(RESERVED.has(word) || ASSIGNMENT.test(word)))) {
      if (words.length === 0) start = line
      words.push(word.replaceAll(QUOTED, unquote))
    }
    if (operator !== undefined && words.length > 0) {
      yield { line: start, words }
      words = []
    }
    line += token.split('\n').length - 1
  }

  if (words.length > 0) yield { line: start, words }
}

function unquote(_: string, single: string | undefined, double: string | undefined, escaped: string): string {
  return single ?? double?.replaceAll(ESCAPED, '$1') ?? escaped
}
