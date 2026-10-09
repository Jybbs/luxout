import type { Audit }           from './audit.ts'
import { type Entry, TomlFile } from './files.ts'
import { Finding, type Spot }   from './finding.ts'

const COLOR    = /^[\da-f]{6}$/
const LIMIT    = 100
const REGISTRY = '.github/labels.toml'

/**
 * A label the registry declares, beside the color and the description its table
 * holds.
 */
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

  /**
   * Reports a color the table leaves out or writes as anything other than six
   * lowercase hex digits.
   */
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

  /**
   * Reports a description the table leaves out, one running past the 100
   * characters GitHub accepts, and one ending on a period.
   *
   * The length counts UTF-16 code units, which run at least as high as code
   * points or grapheme clusters, so a description it passes fits GitHub's limit
   * whichever of those GitHub counts.
   */
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

  /**
   * Reads the color in lowercase, so two spellings of one color compare equal.
   */
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

/**
 * The label registry at `.github/labels.toml`, one table per label keyed by its
 * full name, read as declaring nothing where the checkout holds no registry.
 */
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

  /**
   * Reports a registry that fails to parse, which covers two tables sharing a
   * name, beside each label's own findings and each label taking a color a
   * label above it already takes.
   */
  get findings(): Finding[] {
    return [
      ...this.#file.errors,
      ...this.labels.flatMap((label) => [...label.findings, ...label.sharing(this.labels)])
    ]
  }

  /**
   * Reports each of `named`, the labels another file names, that the registry
   * does not declare.
   */
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
