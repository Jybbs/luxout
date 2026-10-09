import type { Audit }           from './audit.ts'
import { type Entry, YamlFile } from './files.ts'
import type { Finding }         from './finding.ts'
import type { LabelRegistry }   from './labels.ts'

const FRONTMATTER = /^---\n.*?\n(?=---(?:\n|$))/s
const TEMPLATES   = '.github/ISSUE_TEMPLATE/*.{md,yaml,yml}'

/**
 * An issue template, read as the YAML an issue form holds or as the front
 * matter a Markdown template opens on.
 */
class IssueTemplate {
  readonly #file: YamlFile

  /**
   * Parses the front matter of a Markdown template from its opening `---` to
   * the line before its closing one, so each line keeps its number, and reads a
   * Markdown template carrying none as empty.
   */
  constructor(file: string, text: string) {
    this.#file = new YamlFile(file, file.endsWith('.md') ? text.match(FRONTMATTER)?.[0] ?? '' : text)
  }

  /**
   * Reads each label `labels` names, whether it lists them or separates them
   * with commas in one string, each comma-separated name on the string's line.
   */
  get #labels(): Entry[] {
    const labels = this.#file.at('labels')

    if (typeof labels?.value !== 'string') return this.#file.items('labels')

    return labels.value
      .split(',')
      .map((name) => ({ ...labels, value: name.trim() }))
      .filter(({ value }) => value !== '')
  }

  /**
   * Reports a template that fails to parse and each label it names that
   * `registry` does not declare.
   */
  findings(registry: LabelRegistry): Finding[] {
    return [...this.#file.errors, ...registry.undeclared(this.#labels)]
  }
}

/**
 * The issue templates under `.github/ISSUE_TEMPLATE/`.
 */
export class IssueTemplates {
  readonly #templates: IssueTemplate[]

  static read(audit: Audit): IssueTemplates {
    const texts = audit.glob(TEMPLATES).map((file) => [file, audit.read(file)])

    return new IssueTemplates(Object.fromEntries(texts))
  }

  /**
   * Reads each template in `texts`, which keys the text of each by its path.
   */
  constructor(texts: Record<string, string>) {
    this.#templates = Object.entries(texts).map(([file, text]) => new IssueTemplate(file, text))
  }

  findings(registry: LabelRegistry): Finding[] {
    return this.#templates.flatMap((template) => template.findings(registry))
  }
}
