import { type Command, type CommandExpansionPart, type ParseError, parse } from 'unbash'

/**
 * A simple command a script runs, its words after quote removal.
 */
export interface Invocation {
  line  : number
  words : string[]
}

/**
 * The simple commands a script runs, beside each error `unbash` reports, past
 * which commands can go unread.
 */
export interface Scan {
  errors      : { line: number, message: string }[]
  invocations : Invocation[]
}

function is<T extends { type: string }>(node: unknown, type: T['type']): node is T {
  return typeof node === 'object' && node !== null && 'type' in node && node.type === type
}

/**
 * Finds every simple command `script` runs at any depth, numbering its lines
 * from `line`.
 *
 * `unbash` parses a word's parts, a substitution's script among them, only once
 * the word's `parts` getter is read. Each node's `toJSON` reads that getter, so
 * the replacer `JSON.stringify` calls visits every node. A backtick
 * substitution holding an escape indexes the source it decodes, so it is
 * scanned on its own from the line it opens on.
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
