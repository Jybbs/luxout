import type { Audit } from './audit.ts'
import { YamlFile }   from './files.ts'
import { Finding }    from './finding.ts'

const FLOOR          = /(?<=\^)\d[\d.]*/g
const MANIFEST       = 'package.json'
const SITE           = 'site/package.json'
export const numeric = new Intl.Collator('en', { numeric: true })

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

  get floors(): string[] {
    return this.#floors('node')
  }

  /**
   * Reads the floor of the oldest Homebridge line `engines` admits.
   */
  get homebridge(): string | undefined {
    return this.#floors('homebridge').toSorted(numeric.compare)[0]
  }

  get #coverage(): Finding[] {
    const coverage = this.#file.at('devDependencies', '@vitest/coverage-v8')
    const vitest   = this.#file.at('devDependencies', 'vitest')

    if (!coverage || coverage.value === vitest?.value) return []

    const message = `\`@vitest/coverage-v8\` pins ${String(coverage.value)}, whereas \`vitest\`, the release `
                  + `it runs under, pins ${vitest ? String(vitest.value) : 'nothing'}`

    return [new Finding(message, coverage, 'Coverage pin')]
  }

  floor(release: string): string | undefined {
    return this.floors.find((floor) => floor.split('.')[0] === release.split('.')[0])
  }

  /**
   * Reads the release `devDependencies` pins `name` to.
   */
  pin(name: string): string | undefined {
    const pin = this.#file.at('devDependencies', name)?.value

    return typeof pin === 'string' ? pin : undefined
  }

  #floors(engine: string): string[] {
    return String(this.#file.at('engines', engine)?.value).match(FLOOR) ?? []
  }
}
