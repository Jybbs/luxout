import type { Audit } from './audit.ts'
import { YamlFile }   from './files.ts'
import { Finding }    from './finding.ts'

const FLOOR          = /(?<=\^)\d[\d.]*/g
const INSTALLED      = ['site/package.json', 'tests/homebridge/package.json', 'tests/vet/*/package.json']
const MANIFEST       = 'package.json'
const RELEASE        = /^\d+\.\d+\.\d+(?:-[\dA-Za-z.-]+)?(?:\+[\dA-Za-z.-]+)?$/
const SECTIONS       = ['dependencies', 'devDependencies', 'optionalDependencies']
export const numeric = new Intl.Collator('en', { numeric: true })

export class PackageManifest {
  readonly #file: YamlFile

  static read(audit: Audit): PackageManifest {
    return new PackageManifest(audit.read(MANIFEST))
  }

  /**
   * Reads each manifest Bun installs from beside the root's, meaning the
   * site's, the Homebridge UI's under `tests/homebridge`, and each under
   * `tests/vet`, leaving out one the checkout lacks.
   */
  static installed(audit: Audit): PackageManifest[] {
    return Object.entries(audit.readAll(...INSTALLED)).map(([file, text]) => new PackageManifest(text, file))
  }

  constructor(text: string, file = MANIFEST) {
    this.#file = new YamlFile(file, text)
  }

  get findings(): Finding[] {
    return [...this.#file.errors, ...this.#coverage, ...this.#ranges]
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

  /**
   * Reports each entry of `dependencies`, `devDependencies`, and
   * `optionalDependencies` naming anything but one exact release, on the line
   * of its name.
   */
  get #ranges(): Finding[] {
    return SECTIONS.flatMap((section) => this.#file.keys(section).flatMap(({ value: name, ...spot }) => {
      const pin = this.#file.at(section, String(name))?.value

      return typeof pin === 'string' && RELEASE.test(pin) ? [] : [new Finding(
        `\`${String(name)}\` pins ${JSON.stringify(pin)} under \`${section}\`, which names no exact release`,
        spot,
        'Exact pin'
      )]
    }))
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
