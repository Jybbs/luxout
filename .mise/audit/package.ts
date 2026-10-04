import type { Audit } from './audit.ts'
import { YamlFile }   from './files.ts'
import { Finding }    from './finding.ts'

const FLOOR    = /(?<=\^)\d[\d.]*/g
const MANIFEST = 'package.json'

/**
 * The `package.json` at the root of the checkout, holding the pins its checks
 * read against one another.
 */
export class PackageManifest {
  readonly #file: YamlFile

  static read(audit: Audit): PackageManifest {
    return new PackageManifest(audit.read(MANIFEST))
  }

  constructor(text: string) {
    this.#file = new YamlFile(MANIFEST, text)
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
}
