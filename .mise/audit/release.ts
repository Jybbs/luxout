import type { Audit }           from './audit.ts'
import { type Entry, YamlFile } from './files.ts'
import { Finding }              from './finding.ts'
import type { LabelRegistry }   from './labels.ts'

const CATEGORIES = ['changelog', 'categories']
const NOTES      = '.github/release.yml'
const WILDCARD   = '*'

export class ReleaseNotes {
  readonly #file: YamlFile

  static read(audit: Audit): ReleaseNotes {
    return new ReleaseNotes(audit.exists(NOTES) ? audit.read(NOTES) : '')
  }

  constructor(text: string) {
    this.#file = new YamlFile(NOTES, text)
  }

  get #categorized(): Entry[] {
    return this.#inCategories('labels').filter(({ value }) => value !== WILDCARD)
  }

  get #excluded(): Entry[] {
    return [...this.#file.items('changelog', 'exclude', 'labels'), ...this.#inCategories('exclude', 'labels')]
  }

  findings(registry: LabelRegistry): Finding[] {
    const categorized = this.#categorized
    const placed      = Map.groupBy(categorized, ({ value }) => String(value))

    return [
      ...this.#file.errors,
      ...registry.undeclared([...categorized, ...this.#excluded]),
      ...registry.labels.flatMap(({ name, spot }) => {
        const [first, ...repeats] = placed.get(name) ?? []

        if (!first) {
          return [new Finding(`\`${name}\` sits in no category of \`${NOTES}\``, spot, 'Release category')]
        }

        return repeats.map((repeat) => new Finding(
          `\`${name}\` already sits in a category above this line`,
          repeat,
          'Release category'
        ))
      })
    ]
  }

  #inCategories(...path: string[]): Entry[] {
    return this.#file
      .items(...CATEGORIES)
      .flatMap((_, index) => this.#file.items(...CATEGORIES, index, ...path))
  }
}
