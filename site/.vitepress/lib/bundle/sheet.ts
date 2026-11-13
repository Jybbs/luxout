import postcss, { AtRule, type Node, type Root, list } from 'postcss'

const COLOR  = /(?:^|-)color$|^(?:fill|stroke)$/
const IMAGE  = /\[[^\]]*\.(?:avif|gif|jpe?g|png|svg|webp)\b[^\]]*\]/gi
const NUMBER = /^-?[\d.]+$/
const WIDTH  = /(?<=width\D*)[\d.]+[a-z]+/g

/**
 * Holds one stylesheet, the site's source or the build's output.
 */
export class Sheet {
  readonly file  : string
  readonly #root : Root

  constructor(file: string, text: Root | string) {
    this.file  = file
    this.#root = typeof text === 'string' ? postcss.parse(text, { from: file }) : text
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
   * Lists the top-level cascade layers the stylesheet names, in the order it
   * first names each, which is the order the cascade ranks them in, lowest
   * first.
   */
  get layers(): string[] {
    const found = new Set<string>()

    this.#root.each((node) => {
      if (node.type === 'atrule' && node.name === 'layer') {
        for (const name of list.comma(node.params)) found.add(name)
      }
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

  /**
   * Lists each color property a declaration sets to a bare number, written
   * `selector { property: value }`, which is what Tailwind writes for a
   * unitless arbitrary value it reads as a color, such as `text-[0]`.
   */
  get uncolored(): string[] {
    const found: string[] = []

    this.#root.walkDecls(COLOR, ({ parent, prop, value }) => {
      if (parent?.type === 'rule' && NUMBER.test(value)) {
        found.push(`${parent.selector} { ${prop}: ${value} }`)
      }
    })

    return found
  }

  /**
   * Lists each property a rule outside every cascade layer sets, written
   * `selector { property }`, leaving out the frames of each `@keyframes` rule.
   */
  get unlayered(): string[] {
    const found = new Set<string>()

    this.#root.walkDecls(({ parent, prop }) => {
      if (parent?.type === 'rule' && !within(parent)) found.add(`${parent.selector} { ${prop} }`)
    })

    return [...found]
  }

  /**
   * Copies the stylesheet without the blocks of the cascade layer `name`.
   */
  outside(name: string): Sheet {
    const root = this.#root.clone()

    root.walkAtRules('layer', (rule) => {
      if (rule.params === name) rule.remove()
    })

    return new Sheet(this.file, root)
  }

  /**
   * Lists each value the stylesheet's `@theme` gives a variable of the
   * `namespace`, such as each width under `container`.
   */
  theme(namespace: string): string[] {
    const found: string[] = []

    this.#root.walkAtRules('theme', (theme) => {
      theme.walkDecls(new RegExp(`^--${namespace}-`), ({ value }) => {
        if (value !== 'initial') found.push(value)
      })
    })

    return found
  }

  /**
   * Lists each width a `name` query names, such as `48rem` for a media query
   * keyed on a width of at least `48rem`.
   */
  widths(name: 'container' | 'media'): string[] {
    const found = new Set<string>()

    this.#root.walkAtRules(name, ({ params }) => {
      for (const width of params.match(WIDTH) ?? []) found.add(width)
    })

    return [...found]
  }
}

function* calls(value: string): Generator<string> {
  for (const part of list.split(value, [',', ' ', '\n', '\t'], false)) {
    const [, name, inside] = /^([\w-]+)\((.*)\)$/s.exec(part) ?? []

    if (name === 'color-mix') yield part
    if (inside !== undefined) yield* calls(inside)
  }
}

/**
 * Reads whether `node` sits inside a cascade layer or a `@keyframes` rule, at
 * any depth.
 */
function within({ parent }: Node): boolean {
  return parent !== undefined
      && (parent instanceof AtRule && /^layer$|keyframes$/.test(parent.name) || within(parent))
}
