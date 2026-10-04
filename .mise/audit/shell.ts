import { type Command, type CommandExpansionPart, type ParseError, parse } from 'unbash'

/**
 * A simple command a script runs, with the line it starts on and its words
 * after quote removal.
 */
export interface Invocation {
  line  : number
  words : string[]
}

/**
 * The simple commands a script runs, beside each error `unbash` reports where
 * it cannot read the script, past which commands can go unread.
 */
export interface Scan {
  errors      : { line: number, message: string }[]
  invocations : Invocation[]
}

function is<T extends { type: string }>(node: unknown, type: T['type']): node is T {
  return typeof node === 'object' && node !== null && 'type' in node && node.type === type
}

/**
 * Finds every simple command `script` runs in the syntax tree `unbash` parses,
 * those inside compound commands, function bodies, and substitutions included,
 * beside each error the parser reports at any depth, leaving out each
 * redirection, each assignment a declaration such as `export` takes, and each
 * command that only assigns.
 *
 * The tree parses each word's parts, and with them the script each substitution
 * runs, when its `parts` getter is first read, and the `toJSON` of each node
 * reads that getter, so the replacer `JSON.stringify` calls on every value it
 * serializes visits every node. A backtick substitution holding an escape
 * indexes the source it decodes, so it is scanned on its own from the line it
 * opens on.
 *
 * Args:
 *   script : A task's shell script, a whole task file or one entry of a TOML
 *     task's `run`.
 *   line   : The line of its file that `script` starts on.
 */
export function scan(script: string, line = 1): Scan {
  const lineAt      = (pos: number): number => line + script.slice(0, pos).split('\n').length - 1
  const found: Scan = { errors: [], invocations: [] }

  JSON.stringify(parse(script), (key, node: unknown) => {
    if (is<CommandExpansionPart>(node, 'CommandExpansion') && node.script?.source !== undefined) {
      const { errors, invocations } = scan(node.script.source, lineAt(node.pos))

      found.errors.push(...errors)
      found.invocations.push(...invocations)

      return undefined
    }
    if (key === 'errors' && Array.isArray(node)) {
      found.errors.push(...node.map(({ message, pos }: ParseError) => ({ line: lineAt(pos), message })))
    }
    if (is<Omit<Command, 'args' | 'redirects'>>(node, 'Command') && node.name) {
      found.invocations.push({
        line  : lineAt(node.pos),
        words : [node.name, ...node.suffix].flatMap((item) => item.type === 'Word' ? [item.value] : [])
      })
    }

    return node
  })

  return found
}
