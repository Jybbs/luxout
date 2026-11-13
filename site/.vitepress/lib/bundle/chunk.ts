import { uuid } from '@homebridge/hap-nodejs'
import { type ArrowFunctionExpression, Visitor, parseSync } from 'oxc-parser'

/**
 * Holds one script the built site sends the browser.
 */
export class Chunk {
  readonly #code : string
  readonly #file : string

  constructor(code: string, file: string) {
    this.#code = code
    this.#file = file
  }

  /**
   * Lists each piece of the script that runs only on Node, as a line naming
   * the file:
   *
   * - HAP-NodeJS code, found by HAP's base UUID, which every HAP UUID ends on
   * - The empty module Vite builds in place of a Node built-in
   */
  get defects(): string[] {
    return [
      ...this.#code.includes(uuid.BASE_UUID) ? ['carries HAP-NodeJS code'] : [],
      ...this.#stubbed ? ['carries the empty module Vite builds in place of a Node built-in'] : []
    ].map((defect) => `${this.#file}: ${defect}`)
  }

  /**
   * Finds the `(exports, module) => { module.exports = {} }` wrapper Vite and
   * Rolldown write for a module the browser build replaces with nothing.
   */
  get #stubbed(): boolean {
    let found = false

    new Visitor({ ArrowFunctionExpression: (node) => { found ||= stub(node) } })
      .visit(parseSync(this.#file, this.#code).program)

    return found
  }
}

function stub({ body, params: [, module] }: ArrowFunctionExpression): boolean {
  const statement = body.type === 'BlockStatement' && body.body.length === 1 ? body.body[0] : undefined
  const assigned  = statement?.type === 'ExpressionStatement' ? statement.expression : undefined

  return module?.type                     === 'Identifier'
      && assigned?.type                   === 'AssignmentExpression'
      && assigned.left.type               === 'MemberExpression'
      && assigned.left.object.type        === 'Identifier'
      && assigned.left.object.name        === module.name
      && assigned.left.property.type      === 'Identifier'
      && assigned.left.property.name      === 'exports'
      && assigned.right.type              === 'ObjectExpression'
      && assigned.right.properties.length === 0
}
