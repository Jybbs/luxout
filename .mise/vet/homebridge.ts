import { type ChildProcess, spawn } from 'node:child_process'
import { once }                     from 'node:events'
import { readFile, writeFile }      from 'node:fs/promises'
import { join }                     from 'node:path'

import { OUTSIDE } from './monitor.ts'

/**
 * The plugin's block, which a run's `config.json` lists under `platforms`.
 */
export type Block = Record<string, unknown>

/**
 * What one start of Homebridge runs against.
 */
export interface Launch {
  plugins  : string
  port     : number
  signal   : AbortSignal
  storage  : string
  block?   : Block
  offline? : boolean
}

const CONFLICT  = /eaddrinuse|address already in use|port \d+ is already in use/i
const ERRORS    = ['TypeError', 'ReferenceError', 'Cannot find module']
const LISTENING = /is running on port \d+/
const bin       = join('node_modules', '.bin', 'homebridge')
const preloads  = {
  offline : import.meta.resolve('./offline.ts'),
  writes  : import.meta.resolve('./writes.ts')
}

/**
 * Holds a release of Homebridge installed into a directory of its own.
 */
export class Homebridge {
  readonly dir     : string
  readonly version : string

  static async read(dir: string): Promise<Homebridge> {
    const manifest    = join(dir, 'node_modules', 'homebridge', 'package.json')
    const { version } = JSON.parse(await readFile(manifest, 'utf8'))

    return new Homebridge(dir, String(version))
  }

  constructor(dir: string, version: string) {
    this.dir     = dir
    this.version = version
  }

  /**
   * Writes the run's `config.json` into `storage` and starts Homebridge on it,
   * loading only the plugins under `plugins`, with the write preload and, where
   * `offline` is set, the offline preload.
   */
  async start({ block, offline = false, plugins, port, signal, storage }: Launch): Promise<Run> {
    const imports = offline ? [preloads.writes, preloads.offline] : [preloads.writes]
    const config  = {
      accessories : [],
      bridge      : { name: 'Test Bridge', pin: '031-45-154', port, username: username(port) },
      platforms   : block ? [block] : []
    }

    await writeFile(join(storage, 'config.json'), JSON.stringify(config, null, 2))

    return new Run(spawn(
      process.execPath,
      [
        ...imports.flatMap((preload) => ['--import', preload]),
        bin, '-P', plugins, '-Q', '-U', storage, '--strict-plugin-resolution'
      ],
      {
        cwd        : this.dir,
        env        : { ...process.env, HB_STORAGE_PATH: storage },
        killSignal : 'SIGKILL',
        signal     : signal,
        stdio      : ['ignore', 'pipe', 'pipe']
      }
    ))
  }
}

/**
 * Holds one Homebridge process beside everything it has printed to stdout and
 * stderr.
 */
export class Run {
  readonly #child     : ChildProcess
  readonly #exit      : Promise<unknown>
  readonly #listening : PromiseWithResolvers<true>
  #outlasted          : number | undefined
  #output             : string

  constructor(child: ChildProcess) {
    this.#child     = child
    this.#exit      = new Promise((resolve) => child.once('exit', resolve))
    this.#listening = Promise.withResolvers()
    this.#output    = ''

    child.on('error', (error) => this.#print(`${String(error)}\n`))

    for (const stream of [child.stdout, child.stderr]) {
      stream?.setEncoding('utf8').on('data', (chunk: string) => this.#print(chunk))
    }
  }

  get conflicted(): boolean {
    return CONFLICT.test(this.#output)
  }

  /**
   * Names each of `TypeError`, `ReferenceError`, and `Cannot find module` the
   * output carries.
   */
  get errors(): string[] {
    return ERRORS.filter((error) => this.#output.includes(error))
  }

  get exited(): boolean {
    return this.#child.exitCode !== null || this.#child.signalCode !== null
  }

  /**
   * Names each requirement the run broke on its own, meaning each error its
   * output carries, each path it wrote outside its storage, and an exit past
   * the grace `stop` gave it.
   */
  get faults(): string[] {
    return [
      ...this.errors.map((error) => `logs ${error}`),
      ...this.writes.map((path) => `writes ${path} outside the storage directory`),
      ...this.#outlasted === undefined
        ? []
        : [`takes longer than ${this.#outlasted / 1000} seconds to exit after SIGTERM`]
    ]
  }

  get output(): string {
    return this.#output
  }

  /**
   * Names each path the write preload reported outside the storage directory.
   */
  get writes(): string[] {
    return this.#output
      .split('\n')
      .filter((line) => line.startsWith(OUTSIDE))
      .map((line) => line.slice(OUTSIDE.length).trim())
  }

  initialized(alias: string): boolean {
    return this.#output.includes(`Initializing ${alias} platform`)
  }

  /**
   * Waits for Homebridge to report its bridge listening on its port, resolving
   * false where it exits or `timeout` milliseconds pass first.
   */
  async started(timeout: number): Promise<boolean> {
    return Promise.race([this.#listening.promise, this.wait(timeout).then(() => false)])
  }

  /**
   * Sends `SIGTERM` and waits up to `grace` milliseconds for Homebridge to
   * exit, sending `SIGKILL` past that.
   */
  async stop(grace: number): Promise<void> {
    this.#child.kill('SIGTERM')
    await this.wait(grace)

    if (this.exited) return

    this.#outlasted = grace
    this.#child.kill('SIGKILL')
    await this.#exit
  }

  /**
   * Waits until `duration` milliseconds pass or Homebridge exits.
   */
  async wait(duration: number): Promise<void> {
    await Promise.race([this.#exit, once(AbortSignal.timeout(duration), 'abort')])
  }

  #print(chunk: string): void {
    this.#output += chunk

    if (LISTENING.test(this.#output)) this.#listening.resolve(true)
  }
}

function username(port: number): string {
  const hex = port.toString(16).padStart(4, '0').toUpperCase()

  return `CC:22:3D:E3:${hex.slice(0, 2)}:${hex.slice(2)}`
}
