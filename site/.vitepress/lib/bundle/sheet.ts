import postcss, { type Root, list } from 'postcss'

const IMAGE = /\[[^\]]*\.(?:avif|gif|jpe?g|png|svg|webp)\b[^\]]*\]/gi

/**
 * Holds one stylesheet, the site's source or the build's output.
 */
export class Sheet {
  readonly file  : string
  readonly #root : Root

  constructor(file: string, text: string) {
    this.file = file
    this.#root = postcss.parse(text, { from: file })
  }

  /**
   * Lists each attribute selector keyed on an image address, such as
   * `[src$="logo.svg"]`.
   */
  get images(): string[] {
    const found = new Set<string>()

    this.#root.walkRules(({ selector }) => {
      for (const [match] of selector.matchAll(IMAGE)) found.add(match)
    })

    return [...found]
  }

  /**
   * Lists each `color-mix()` call the declarations hold, nested calls
   * included, as the stylesheet writes them.
   */
  get mixes(): string[] {
    const found: string[] = []

    this.#root.walkDecls(({ value }) => {
      found.push(...calls(value))
    })

    return found
  }
}

function* calls(value: string): Generator<string> {
  for (const part of list.split(value, [',', ' ', '\n', '\t'], false)) {
    const [, name, inside] = /^([\w-]+)\((.*)\)$/s.exec(part) ?? []

    if (name === 'color-mix') yield part
    if (inside !== undefined) yield* calls(inside)
  }
}
