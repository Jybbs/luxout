import type { Audit }           from './audit.ts'
import { type Entry, YamlFile } from './files.ts'
import { Finding }              from './finding.ts'
import type { Workflows }       from './workflows.ts'

const RULESETS = '.github/rulesets/*.json'

class Ruleset {
  readonly #file: YamlFile

  constructor(file: string, text: string) {
    this.#file = new YamlFile(file, text)
  }

  get #contexts(): Entry[] {
    return this.#file.items('rules').flatMap((_, index) => {
      const checks = ['rules', index, 'parameters', 'required_status_checks']

      return this.#file.items(...checks)
        .flatMap((_, check) => this.#file.at(...checks, check, 'context') ?? [])
    })
  }

  /**
   * Holds a branch ruleset's required checks to the gates `workflows` finds,
   * reporting each required check that is no gate and each gate the ruleset
   * leaves out.
   */
  findings(workflows: Workflows): Finding[] {
    const { errors } = this.#file

    if (errors.length > 0 || (this.#file.at('target')?.value ?? 'branch') !== 'branch') return errors

    const contexts = this.#contexts
    const gates    = workflows.gates
    const name     = String(this.#file.at('name')?.value)
    const named    = new Set(gates.map((gate) => gate.name))
    const required = new Set(contexts.map(({ value }) => value))

    return [
      ...contexts.filter(({ value }) => !named.has(value)).map((context) => new Finding(
        `\`${name}\` requires the check \`${String(context.value)}\`, `
      + 'which is not the gate of any workflow that runs on `pull_request`',
        context,
        'Required check'
      )),
      ...gates.filter((gate) => !required.has(gate.name)).map((gate) => new Finding(
        `\`${name}\` does not require \`${String(gate.name)}\`, the gate \`${gate.spot.file}\` ends on`,
        this.#file.at('rules') ?? this.#file.start,
        'Required check'
      ))
    ]
  }
}

export class Rulesets {
  readonly #rulesets: Ruleset[]

  static read(audit: Audit): Rulesets {
    return new Rulesets(audit.readAll(RULESETS))
  }

  constructor(files: Record<string, string>) {
    this.#rulesets = Object.entries(files).map(([file, text]) => new Ruleset(file, text))
  }

  findings(workflows: Workflows): Finding[] {
    return this.#rulesets.flatMap((ruleset) => ruleset.findings(workflows))
  }
}
