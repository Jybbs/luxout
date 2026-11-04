import { basename, dirname } from 'node:path'

import type { Audit }           from './audit.ts'
import { YamlFile }             from './files.ts'
import { Finding }              from './finding.ts'
import type { PackageManifest } from './package.ts'

const MANIFESTS   = 'tests/vet/*/package.json'
const TITLE       = 'Vet pin'
const conjunction = new Intl.ListFormat('en', { type: 'conjunction' })

/**
 * Holds the manifest of each Homebridge release `plugin:vet` installs, each in
 * a directory under `tests/vet` named for the source its `homebridge` pin
 * follows.
 */
export class VetManifests {
  readonly #files: YamlFile[]

  static read(audit: Audit): VetManifests {
    return new VetManifests(audit.readAll(MANIFESTS))
  }

  constructor(files: Record<string, string>) {
    this.#files = Object.entries(files).map(([file, text]) => new YamlFile(file, text))
  }

  /**
   * Holds the `homebridge` pin under `tests/vet/floor` to the floor of the
   * oldest line `engines.homebridge` admits, and the one under
   * `tests/vet/pinned` to the release the `homebridge` devDependency pins,
   * reporting either manifest missing.
   */
  findings(manifest: PackageManifest): Finding[] {
    const sources = new Map([
      ['floor', { release: manifest.homebridge, source: '`engines.homebridge` sets its floor at' }],
      ['pinned', { release: manifest.pin('homebridge'), source: 'the `homebridge` devDependency pins' }]
    ])
    const roles   = new Set(this.#files.map(({ file }) => basename(dirname(file))))
    const missing = sources.entries()
      .filter(([role]) => !roles.has(role))
      .map(([role, held]) => new Finding(
        `\`tests/vet/${role}/package.json\` is missing, whereas ${held.source} ${held.release ?? 'nothing'}`,
        { file: `tests/vet/${role}/package.json`, line: 1 },
        TITLE
      ))
      .toArray()

    return [...missing, ...this.#files.flatMap((file) => {
      const role  = basename(dirname(file.file))
      const entry = file.at('dependencies', 'homebridge')
      const pin   = typeof entry?.value === 'string' ? entry.value : undefined
      const held  = sources.get(role)

      if (!held) {
        return [...file.errors, new Finding(
          `\`tests/vet/${role}\` names no source its \`homebridge\` pin follows, `
        + `since only ${conjunction.format(sources.keys().map((name) => `\`${name}\``))} name one`,
          file.start,
          TITLE
        )]
      }

      return [...file.errors, ...pin === held.release ? [] : [new Finding(
        `\`homebridge\` pins ${pin ?? 'nothing'}, whereas ${held.source} ${held.release ?? 'nothing'}`,
        entry ?? file.start,
        TITLE
      )]]
    })]
  }
}
