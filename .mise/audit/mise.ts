import type { Audit }           from './audit.ts'
import { TomlFile }             from './files.ts'
import { Finding }              from './finding.ts'
import type { PackageManifest } from './package.ts'

export const CONFIG = '.mise/config.toml'
const NUMERIC       = new Intl.Collator('en', { numeric: true })

export class MiseConfig {
  readonly #file: TomlFile

  static read(audit: Audit): MiseConfig {
    return new MiseConfig(audit.read(CONFIG))
  }

  constructor(text: string) {
    this.#file = new TomlFile(CONFIG, text)
  }

  findings(manifest: PackageManifest): Finding[] {
    return [...this.#file.errors, ...this.#node(manifest)]
  }

  #node(manifest: PackageManifest): Finding[] {
    const pin = this.#file.at('tools', 'node')

    if (!pin) return []

    const floor   = manifest.floors.toSorted(NUMERIC.compare).at(-1)
    const release = String(pin.value)

    const inside = floor                           !== undefined
                && manifest.floor(release)         === floor
                && NUMERIC.compare(release, floor)  >= 0

    const message = floor === undefined
                  ? `\`engines\` admits no caret range for Node ${release} to sit inside`
                  : `Node ${release} sits outside ^${floor}, the newest line \`engines\` admits`

    return inside ? [] : [new Finding(message, pin, 'Node pin')]
  }
}
