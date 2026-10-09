import type { Audit }           from './audit.ts'
import { type Entry, YamlFile } from './files.ts'
import { Finding }              from './finding.ts'
import type { LabelRegistry }   from './labels.ts'

const CATEGORIES = ['changelog', 'categories']
const NOTES      = '.github/release.yml'
const WILDCARD   = '*'

/**
 * The `.github/release.yml` at the root of the checkout, holding the categories
 * GitHub sorts a release's generated notes into, read as holding none where the
 * checkout lacks the file.
 */
export class ReleaseNotes {
  readonly #file: YamlFile

  static read(audit: Audit): ReleaseNotes {
    return new ReleaseNotes(audit.exists(NOTES) ? audit.read(NOTES) : '')
  }

  constructor(text: string) {
    this.#file = new YamlFile(NOTES, text)
  }

  /**
   * Reads each label a category files a pull request under, the `*` catch-all
   * aside, in the order the categories rank.
   */
  get #categorized(): Entry[] {
    return this.#inCategories('labels').filter(({ value }) => value !== WILDCARD)
  }

  /**
   * Reads each label the notes leave out, whether from every category or from
   * one alone.
   */
  get #excluded(): Entry[] {
    return [...this.#file.items('changelog', 'exclude', 'labels'), ...this.#inCategories('exclude', 'labels')]
  }

  /**
   * Reports a file that fails to parse, each label it names that `registry`
   * does not declare, each label `registry` declares that sits in no category,
   * and each repeat of a label an earlier category already holds.
   */
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

  /**
   * Reads each item of the sequence at `path` inside each category, in the
   * order the categories rank.
   */
  #inCategories(...path: string[]): Entry[] {
    return this.#file
      .items(...CATEGORIES)
      .flatMap((_, index) => this.#file.items(...CATEGORIES, index, ...path))
  }
}
