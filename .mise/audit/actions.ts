import { posix } from 'node:path'

import type { Audit }           from './audit.ts'
import { type Entry, YamlFile } from './files.ts'
import { Finding }              from './finding.ts'
import { Step }                 from './steps.ts'

const MANIFESTS = '.github/actions/*/action.{yaml,yml}'
const SELF      = /^\$\//

export class Actions {
  readonly #manifests: Manifest[]

  static read(audit: Audit): Actions {
    return new Actions(audit.readAll(MANIFESTS))
  }

  constructor(files: Record<string, string>) {
    this.#manifests = Object.entries(files).map(([file, text]) => new Manifest(file, text))
  }

  get findings(): Finding[] {
    return this.#manifests.flatMap((manifest) => manifest.findings)
  }

  get pins(): Entry[] {
    return this.#manifests.flatMap((manifest) => manifest.steps.flatMap((step) => step.uses ?? []))
  }

  /**
   * Finds the inputs declared by the manifest in the directory `uses` names,
   * whether `uses` opens on `$/` or `./`.
   */
  inputs(uses: string): Set<string> | undefined {
    const directory = posix.normalize(uses.replace(SELF, ''))

    return this.#manifests.find((manifest) => manifest.directory === directory)?.inputs
  }
}

class Manifest {
  readonly directory : string
  readonly #file     : YamlFile

  constructor(file: string, text: string) {
    this.directory = posix.dirname(file)
    this.#file     = new YamlFile(file, text)
  }

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
