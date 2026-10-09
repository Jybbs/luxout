import type { Audit } from './audit.ts'
import { YamlFile }   from './files.ts'
import { Finding }    from './finding.ts'

const FLOOR    = /(?<=\^)\d[\d.]*/g
const MANIFEST = 'package.json'
const SITE     = 'site/package.json'

export class PackageManifest {
  readonly #file: YamlFile

  static read(audit: Audit): PackageManifest {
    return new PackageManifest(audit.read(MANIFEST))
  }

  static site(audit: Audit): PackageManifest | undefined {
    return audit.exists(SITE) ? new PackageManifest(audit.read(SITE), SITE) : undefined
  }

  constructor(text: string, file = MANIFEST) {
    this.#file = new YamlFile(file, text)
  }

  get findings(): Finding[] {
    return [...this.#file.errors, ...this.#coverage]
  }

  /**
   * Reads the floor of each caret range `engines.node` admits.
   */
  get floors(): string[] {
    return String(this.#file.at('engines', 'node')?.value).match(FLOOR) ?? []
  }

  /**
   * Holds `@vitest/coverage-v8` to the `vitest` release it runs under.
   */
  get #coverage(): Finding[] {
    const coverage = this.#file.at('devDependencies', '@vitest/coverage-v8')
    const vitest   = this.#file.at('devDependencies', 'vitest')

    if (!coverage || coverage.value === vitest?.value) return []

    const message = `\`@vitest/coverage-v8\` pins ${String(coverage.value)}, whereas \`vitest\`, the release `
                  + `it runs under, pins ${vitest ? String(vitest.value) : 'nothing'}`

    return [new Finding(message, coverage, 'Coverage pin')]
  }

  /**
   * Reads the floor `engines.node` admits for the line `release` sits on, such
   * as `22.23.3` for any release of Node 22, or nothing where it admits no such
   * line.
   */
  floor(release: string): string | undefined {
    return this.floors.find((floor) => floor.split('.')[0] === release.split('.')[0])
  }
}
