import { isDeepStrictEqual } from 'node:util'

import { type AST, ParseError, getStaticTOMLValue, parseTOML, traverseNodes }       from 'toml-eslint-parser'
import { type Document, LineCounter, isAlias, isMap, isNode, parseDocument, visit } from 'yaml'

import { Finding, type Spot } from './finding.ts'

/**
 * A value one of the audited files holds, beside the file and line it sits on
 * and any comment trailing it there.
 */
export interface Entry extends Spot {
  value    : unknown
  comment? : string
}

export type Key = number | string

const PARSE = 'Parse error'

/**
 * A TOML file parsed through `toml-eslint-parser`, which gives each table, key,
 * and value the line it sits on.
 */
export class TomlFile {
  readonly errors   : Finding[]
  readonly file     : string
  readonly #program : AST.TOMLProgram
  readonly #text    : string
  readonly #value   : unknown

  /**
   * Parses `text`, holding a parse error as a finding beside the empty program,
   * so every lookup into a file that fails to parse finds nothing.
   */
  constructor(file: string, text: string) {
    this.file  = file
    this.#text = text

    try {
      this.#program = parseTOML(text)
      this.errors   = []
    } catch (error) {
      if (!(error instanceof ParseError)) throw error
      this.#program = parseTOML('')
      this.errors   = [new Finding(error.message, { file, line: error.lineNumber }, PARSE)]
    }

    this.#value = getStaticTOMLValue(this.#program)
  }

  /**
   * Finds the table or the value at `path`, whether a table header or a dotted
   * key spells it out.
   */
  at(...path: Key[]): Entry | undefined {
    const node  = this.#find(path)
    const value = path.reduce<unknown>((table, key) => Reflect.get(Object(table), key), this.#value)

    return node && { file: this.file, line: node.loc.start.line, value }
  }

  /**
   * Finds the line a string value equal to `text` starts on inside the table or
   * the value at `path`, or anywhere in the file where nothing sits at `path`,
   * past the newline TOML trims after a multi-line string's opening delimiter.
   */
  lineOf(text: string, ...path: Key[]): number | undefined {
    let line: number | undefined

    traverseNodes(this.#find(path) ?? this.#program, {
      leaveNode : () => {},
      enterNode : (node) => {
        if (node.type === 'TOMLValue' && node.kind === 'string' && node.value === text) {
          line ??= node.loc.start.line + Number(node.multiline && this.#text[node.range[0] + 3] === '\n')
        }
      }
    })

    return line
  }

  #find(path: Key[]): AST.TOMLNode | undefined {
    return keyed(this.#program.body[0].body).find(([key]) => isDeepStrictEqual(key, path))?.[1]
  }
}

/**
 * A YAML or JSON file parsed through `yaml`, whose `LineCounter` gives each
 * node the line it sits on.
 */
export class YamlFile {
  readonly file      : string
  readonly #document : Document.Parsed
  readonly #lines    : LineCounter

  constructor(file: string, text: string) {
    this.file      = file
    this.#lines    = new LineCounter()
    this.#document = parseDocument(text, { lineCounter: this.#lines, prettyErrors: false })
  }

  /**
   * Finds every alias the document holds on its line and every anchor on the
   * line of the node it marks, each valued as it is written, such as `&step`
   * or `*step`.
   */
  get anchors(): Entry[] {
    const anchors: Entry[] = []

    visit(this.#document, {
      Node: (_, node) => {
        const value = isAlias(node) ? `*${node.source}` : node.anchor && `&${node.anchor}`

        if (value && node.range) anchors.push({ ...this.#spot(node.range[0]), value })
      }
    })

    return anchors
  }

  get errors(): Finding[] {
    return this.#document.errors.map((error) => new Finding(error.message, this.#spot(error.pos[0]), PARSE))
  }

  /**
   * Finds the node at `path`, each step a key of a mapping or an index of a
   * sequence.
   */
  at(...path: Key[]): Entry | undefined {
    const node = this.#document.getIn(path, true)

    return isNode(node) && node.range
         ? { ...this.#spot(node.range[0]), comment: node.comment ?? undefined, value: node.toJSON() }
         : undefined
  }

  /**
   * Finds each key of the mapping at `path` on its line, valued by the key
   * itself, or none where no mapping sits there.
   */
  keys(...path: Key[]): Entry[] {
    const node = this.#document.getIn(path, true)
    const keys = isMap(node) ? node.items.map(({ key }) => key).filter(isNode) : []

    return keys.flatMap((key) => key.range ? [{ ...this.#spot(key.range[0]), value: key.toJSON() }] : [])
  }

  #spot(offset: number): Spot {
    return { file: this.file, line: this.#lines.linePos(offset).line }
  }
}

function* keyed(
  body   : (AST.TOMLKeyValue | AST.TOMLTable)[],
  prefix : Key[] = []
): Generator<[Key[], AST.TOMLNode]> {
  for (const node of body) {
    if (node.type === 'TOMLTable') {
      yield [node.resolvedKey, node]
      yield* keyed(node.body, node.resolvedKey)
    } else {
      yield [[...prefix, ...getStaticTOMLValue(node.key)], node.value]
    }
  }
}
