import type { Audit }           from './audit.ts'
import { type Entry, YamlFile } from './files.ts'
import type { Finding }         from './finding.ts'
import type { LabelRegistry }   from './labels.ts'

const FRONTMATTER = /^---\n.*?\n(?=---(?:\n|$))/s
const TEMPLATES   = '.github/ISSUE_TEMPLATE/*.{md,yaml,yml}'

class IssueTemplate {
  readonly #file: YamlFile

  /**
   * Keeps a Markdown template's opening `---` in the front matter it parses, so
   * each line keeps its number.
   */
  constructor(file: string, text: string) {
    this.#file = new YamlFile(file, file.endsWith('.md') ? text.match(FRONTMATTER)?.[0] ?? '' : text)
  }

  get #labels(): Entry[] {
    const labels = this.#file.at('labels')

    if (typeof labels?.value !== 'string') return this.#file.items('labels')

    return labels.value
      .split(',')
      .map((name) => ({ ...labels, value: name.trim() }))
      .filter(({ value }) => value !== '')
  }

  findings(registry: LabelRegistry): Finding[] {
    return [...this.#file.errors, ...registry.undeclared(this.#labels)]
  }
}

export class IssueTemplates {
  readonly #templates: IssueTemplate[]

  static read(audit: Audit): IssueTemplates {
    return new IssueTemplates(audit.readAll(TEMPLATES))
  }

  constructor(files: Record<string, string>) {
    this.#templates = Object.entries(files).map(([file, text]) => new IssueTemplate(file, text))
  }

  findings(registry: LabelRegistry): Finding[] {
    return this.#templates.flatMap((template) => template.findings(registry))
  }
}
