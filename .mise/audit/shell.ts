import { type SyntaxNode, forEachChild, parse } from 'unbash'

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

/**
 * Finds every simple command `script` runs at any depth, numbering its lines
 * from `line`.
 *
 * `forEachChild` resolves each substitution's script as it visits the word
 * holding it, and each script carries its own `errors`. A backtick
 * substitution holding an escape indexes the source it decodes, so it is
 * scanned on its own from the line it opens on.
 */
export function scan(script: string, line = 1): Scan {
  const lineAt      = (pos: number): number => line + script.slice(0, pos).split('\n').length - 1
  const found: Scan = { errors: [], invocations: [] }

  const visit = (node: SyntaxNode): void => {
    if (node.type === 'CommandExpansion' && node.script?.source !== undefined) {
      const { errors, invocations } = scan(node.script.source, lineAt(node.pos))

      found.errors.push(...errors)
      found.invocations.push(...invocations)

      return
    }
    if (node.type === 'Script') {
      found.errors.push(...(node.errors ?? []).map(({ message, pos }) => ({ line: lineAt(pos), message })))
    }
    if (node.type === 'Command' && node.name) {
      found.invocations.push({
        line  : lineAt(node.pos),
        words : [node.name, ...node.args].flatMap((item) => item.type === 'Word' ? [item.value] : [])
      })
    }
    forEachChild(node, visit)
  }

  visit(parse(script))

  return found
}
