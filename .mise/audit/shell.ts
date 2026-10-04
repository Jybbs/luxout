import { type Command, parse } from 'unbash'

/**
 * A simple command a script runs, with the line it starts on and its words
 * after quote removal.
 */
export interface Invocation {
  line  : number
  words : string[]
}

function isCommand(node: unknown): node is Command {
  return typeof node === 'object' && node !== null && 'type' in node && node.type === 'Command'
}

/**
 * Finds every simple command `script` runs in the syntax tree `unbash` parses,
 * those inside compound commands, function bodies, and command substitutions
 * included, leaving out each redirection and each command that only assigns.
 *
 * The tree holds each word's parts and each substitution's script behind lazy
 * getters that its `toJSON` reads, so the replacer `JSON.stringify` calls on
 * every value it serializes visits every node.
 *
 * Args:
 *   script : A task's shell script, a whole task file or one entry of a TOML
 *     task's `run`.
 *   line   : The line of its file that `script` starts on.
 */
export function invocations(script: string, line = 1): Invocation[] {
  const found: Invocation[] = []

  JSON.stringify(parse(script), (_, node: unknown) => {
    if (isCommand(node) && node.name) {
      found.push({
        line  : line + script.slice(0, node.pos).split('\n').length - 1,
        words : [node.name, ...node.suffix].flatMap((item) => item.type === 'Word' ? [item.value] : [])
      })
    }

    return node
  })

  return found
}
