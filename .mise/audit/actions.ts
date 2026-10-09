import { posix } from 'node:path'

import type { Audit }           from './audit.ts'
import { type Entry, YamlFile } from './files.ts'
import { Finding }              from './finding.ts'
import { Step }                 from './steps.ts'

const MANIFESTS = ['.github/actions/*/action.yml', '.github/actions/*/action.yaml']
const SELF      = /^\$\//

/**
 * The composite actions under `.github/actions/`, each a directory holding its
 * `action.yml`.
 */
export class Actions {
  readonly #manifests: Manifest[]

  static read(audit: Audit): Actions {
    return new Actions(audit.readAll(...MANIFESTS))
  }

  /**
   * Reads each manifest from its text in `files`, keyed by its path relative to
   * the checkout.
   */
  constructor(files: Record<string, string>) {
    this.#manifests = Object.entries(files).map(([file, text]) => new Manifest(file, text))
  }

  get findings(): Finding[] {
    return this.#manifests.flatMap((manifest) => manifest.findings)
  }

  /**
   * Finds the action each step of every manifest names through `uses`.
   */
  get pins(): Entry[] {
    return this.#manifests.flatMap((manifest) => manifest.steps.flatMap((step) => step.uses ?? []))
  }

  /**
   * Finds the inputs the manifest declares in the directory `uses` names, such
   * as `$/.github/actions/provision` or `./.github/actions/provision`, or
   * nothing where no manifest sits there.
   */
  inputs(uses: string): Set<string> | undefined {
    const directory = posix.normalize(uses.replace(SELF, ''))

    return this.#manifests.find((manifest) => manifest.directory === directory)?.inputs
  }
}

/**
 * One composite action's manifest, `action.yml` in the directory a workflow
 * names through `uses`.
 */
class Manifest {
  readonly directory : string
  readonly #file     : YamlFile

  constructor(file: string, text: string) {
    this.directory = posix.dirname(file)
    this.#file     = new YamlFile(file, text)
  }

  /**
   * Reports each error the manifest fails to parse on, each anchor and alias
   * it holds, which GitHub's action-manifest parser rejects, and each step
   * writing the step summary, which only a workflow's gate writes.
   */
  get findings(): Finding[] {
    return [
      ...this.#file.errors,
      ...this.#file.anchors.map((anchor) => new Finding(
        `\`${String(anchor.value)}\` is a YAML anchor or alias, which GitHub rejects in an action manifest`,
        anchor,
        'YAML anchor'
      )),
      ...this.steps.flatMap((step) => step.findings)
    ]
  }

  get inputs(): Set<string> {
    return new Set(Object.keys(Object(this.#file.at('inputs')?.value)))
  }

  get steps(): Step[] {
    return Step.list(this.#file, 'runs', 'steps')
  }
}
