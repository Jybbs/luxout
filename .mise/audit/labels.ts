import type { Audit }           from './audit.ts'
import { type Entry, TomlFile } from './files.ts'
import { Finding, type Spot }   from './finding.ts'

const COLOR    = /^[\da-f]{6}$/
const LIMIT    = 100  // GitHub's limit on a label description, checked in UTF-16 code units
const REGISTRY = '.github/labels.toml'

class Label {
  readonly name         : string
  readonly spot         : Spot
  readonly #color       : Entry | undefined
  readonly #description : Entry | undefined

  constructor(file: TomlFile, name: string) {
    this.name         = name
    this.spot         = { file: file.file, line: file.at(name)?.line ?? 1 }
    this.#color       = file.at(name, 'color')
    this.#description = file.at(name, 'description')
  }

  get findings(): Finding[] {
    return [...this.#colorFindings, ...this.#descriptionFindings]
  }

  get #colorFindings(): Finding[] {
    const { name } = this
    const color    = this.#color

    if (!color) return [new Finding(`\`${name}\` declares no \`color\``, this.spot, 'Label color')]

    const hex = String(color.value)

    return COLOR.test(hex) ? [] : [
      new Finding(
        `\`${name}\` takes the color \`${hex}\`, which is not six lowercase hex digits`,
        color,
        'Label color'
      )
    ]
  }

  get #descriptionFindings(): Finding[] {
    const { name }    = this
    const description = this.#description

    if (!description) {
      return [new Finding(`\`${name}\` declares no \`description\``, this.spot, 'Label description')]
    }

    const text = String(description.value)

    return [
      ...text.length > LIMIT ? [
        new Finding(
            `The description of \`${name}\` runs ${text.length} UTF-16 code units, `
          + `past the ${LIMIT} characters GitHub accepts`,
          description,
          'Label description'
        )
      ] : [],
      ...text.endsWith('.') ? [
        new Finding(`The description of \`${name}\` ends on a period`, description, 'Label description')
      ] : []
    ]
  }

  get #hex(): string | undefined {
    return this.#color && String(this.#color.value).toLowerCase()
  }

  /**
   * Reports the color a label listed above this one in `labels` already takes.
   */
  sharing(labels: Label[]): Finding[] {
    const color = this.#color
    const first = labels.find((label) => label.#hex === this.#hex)

    return color && first && first !== this ? [
      new Finding(
        `\`${this.name}\` takes the color \`${this.#hex}\`, which \`${first.name}\` already takes`,
        color,
        'Label color'
      )
    ] : []
  }
}

export class LabelRegistry {
  readonly labels : Label[]
  readonly #file  : TomlFile
  readonly #names : Set<string>

  static read(audit: Audit): LabelRegistry {
    return new LabelRegistry(audit.exists(REGISTRY) ? audit.read(REGISTRY) : '')
  }

  constructor(text: string) {
    this.#file  = new TomlFile(REGISTRY, text)
    this.labels = Object.keys(Object(this.#file.at()?.value)).map((name) => new Label(this.#file, name))
    this.#names = new Set(this.labels.map(({ name }) => name))
  }

  get findings(): Finding[] {
    return [
      ...this.#file.errors,
      ...this.labels.flatMap((label) => [...label.findings, ...label.sharing(this.labels)])
    ]
  }

  undeclared(named: Entry[]): Finding[] {
    return named
      .filter(({ value }) => !this.#names.has(String(value)))
      .map((entry) => new Finding(
        `\`${REGISTRY}\` declares no label \`${String(entry.value)}\``,
        entry,
        'Unknown label'
      ))
  }
}
