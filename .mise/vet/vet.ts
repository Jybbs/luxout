import { mkdir, readFile, rm } from 'node:fs/promises'
import { join, resolve }       from 'node:path'

import getPort from 'get-port'

import { Homebridge } from './homebridge.ts'
import * as scenario  from './scenario.ts'

type Write = (line: string) => void

export const HELD = [51826, 8581]  // HAP's default bridge port and the Homebridge UI's default port
const TUNING      = { grace: 12_000, observe: 30_000, settle: 1_500 }
const conjunction = new Intl.ListFormat('en', { type: 'conjunction' })

/**
 * Replays the runtime scenarios of Homebridge's verification checks against an
 * unpacked plugin under each release of Homebridge it holds.
 */
export class Vet {
  readonly #checks   : scenario.Check[]
  readonly #plugins  : string
  readonly #releases : Homebridge[]
  readonly #tuning   : scenario.Tuning
  readonly #write    : Write

  /**
   * Builds the checks from the `config.schema.json` under `root` and reads the
   * release installed into each directory `args` names after its first, which
   * names the directory holding the unpacked plugin.
   */
  static async read(args: string[], root: string, tuning?: scenario.Tuning, write?: Write): Promise<Vet> {
    const [plugins = root, ...installs] = args.map((arg) => resolve(root, arg))
    const releases                      = await Promise.all(installs.map((dir) => Homebridge.read(dir)))
    const schema                        = await readFile(join(root, 'config.schema.json'), 'utf8')

    return new Vet(scenario.checks(JSON.parse(schema)), plugins, releases, tuning, write)
  }

  constructor(
    checks   : scenario.Check[],
    plugins  : string,
    releases : Homebridge[],
    tuning   : scenario.Tuning = TUNING,
    write    : Write           = console.log
  ) {
    this.#checks   = checks
    this.#plugins  = plugins
    this.#releases = releases
    this.#tuning   = tuning
    this.#write    = write
  }

  /**
   * Runs every check under every release at once, each in a storage directory
   * of its own under its release's directory and on a port no other run holds,
   * then prints a line for each and the output of each that fails.
   *
   * Returns:
   *   1 where any check fails, and 0 otherwise.
   */
  async run(): Promise<number> {
    const controller = new AbortController()

    try {
      const reports = await Promise.all(this.#releases.flatMap(
        (homebridge) => this.#checks.map((check) => this.#check(check, homebridge, controller.signal))
      ))

      for (const { line } of reports) this.#write(line)

      return Number(reports.some(({ failed }) => failed))
    } finally {
      controller.abort()
    }
  }

  async #check(
    check      : scenario.Check,
    homebridge : Homebridge,
    signal     : AbortSignal
  ): Promise<{ failed: boolean, line: string }> {
    const label   = `Homebridge ${homebridge.version}, ${check.name}`
    const storage = join(homebridge.dir, 'storage', check.name.replaceAll(' ', '-'))
    const port    = await getPort({ exclude: HELD, reserve: true })

    await rm(storage, { force: true, recursive: true })
    await mkdir(storage, { recursive: true })

    const stage                = { plugins: this.#plugins, port, signal, storage }
    const { failures, output } = await check.run(homebridge, stage, this.#tuning)

    return failures.length === 0
         ? { failed: false, line: `${label}: passes` }
         : { failed: true, line: `${label}: fails, since it ${conjunction.format(failures)}\n${output}` }
  }
}
