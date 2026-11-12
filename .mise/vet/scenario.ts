import { isDeepStrictEqual } from 'node:util'

import { type PluginSchema, blocks }           from './blocks.ts'
import type { Block, Homebridge, Launch, Run } from './homebridge.ts'

/**
 * A run of Homebridge under one block, held to what Homebridge's verification
 * checks require of the plugin.
 */
export interface Check {
  block : Block | undefined
  name  : string

  run(homebridge: Homebridge, stage: Stage, tuning: Tuning): Promise<Verdict>
}

/**
 * Where a check starts Homebridge, whatever block it starts it with.
 */
export type Stage = Omit<Launch, 'block' | 'insecure' | 'offline'>

/**
 * The milliseconds each wait of a check lasts:
 *
 * - `grace`, for Homebridge to exit after `SIGTERM`
 * - `observe`, for a run to be watched from its start
 * - `settle`, for a second start to run before it is stopped
 */
export interface Tuning {
  grace   : number
  observe : number
  settle  : number
}

/**
 * Each requirement a check found Homebridge failing, beside the output of each
 * run it started.
 */
export interface Verdict {
  failures : string[]
  output   : string
}

const NEVER = 'never reports its bridge listening'

/**
 * Starts Homebridge under one block for the window the checks watch a run,
 * failing where it never listens, exits on its own, initializes the platform
 * other than its block calls for, logs a `TypeError`, a `ReferenceError`, or
 * `Cannot find module`, writes outside its storage, or outlasts the grace after
 * `SIGTERM`.
 */
export class Scenario implements Check {
  readonly block   : Block | undefined
  readonly name    : string
  readonly offline : boolean
  readonly #alias  : string

  constructor(alias: string, name: string, block?: Block, offline = false) {
    this.block   = block
    this.name    = name
    this.offline = offline
    this.#alias  = alias
  }

  async run(homebridge: Homebridge, stage: Stage, { grace, observe }: Tuning): Promise<Verdict> {
    const run       = await homebridge.start({ ...stage, block: this.block, offline: this.offline })
    const [started] = await Promise.all([run.started(observe), run.wait(observe)])
    const lasted    = !run.exited

    await run.stop(grace)

    return {
      output   : run.output,
      failures : [
        ...started ? [] : [NEVER],
        ...lasted ? [] : ['exits before it is stopped'],
        ...this.#initialization(run),
        ...run.faults
      ]
    }
  }

  #initialization(run: Run): string[] {
    const loaded   = run.initialized(this.#alias)
    const platform = `the ${this.#alias} platform`

    if (loaded === (this.block !== undefined)) return []

    return [loaded ? `initializes ${platform} with no block` : `never initializes ${platform}`]
  }
}

/**
 * Starts Homebridge under the full block and stops it as soon as it listens,
 * then starts it again on the same port and storage, failing where either run
 * outlasts the grace after `SIGTERM` or the second meets `EADDRINUSE`.
 */
export class Shutdown implements Check {
  readonly block : Block
  readonly name  : string

  constructor(block: Block) {
    this.block = block
    this.name  = 'shutdown and restart'
  }

  async run(homebridge: Homebridge, stage: Stage, { grace, observe, settle }: Tuning): Promise<Verdict> {
    const first   = await homebridge.start({ ...stage, block: this.block })
    const started = await first.started(observe)

    await first.stop(grace)

    if (!started) return { failures: [NEVER, ...first.faults], output: first.output }

    const second = await homebridge.start({ ...stage, block: this.block })

    if (await second.started(observe)) await second.wait(settle)

    await second.stop(grace)

    return {
      output   : first.output + second.output,
      failures : [
        ...first.faults,
        ...second.conflicted ? [`meets EADDRINUSE starting again on port ${stage.port}`] : [],
        ...second.faults
      ]
    }
  }
}

/**
 * Builds the checks Homebridge's verification runs at launch, where a block
 * equal to an earlier one runs once.
 *
 * Returns:
 *   A run with no block, one per distinct block among the platform alone and
 *   the minimal and full blocks `blocks` draws, one with the full block and
 *   every host name lookup failing, and one stopping and starting again under
 *   the full block.
 */
export function checks(plugin: PluginSchema): Check[] {
  const { full, minimal } = blocks(plugin)
  const { pluginAlias }   = plugin
  const runs              = [
    { block: { platform: pluginAlias }, name: 'platform only' },
    { block: minimal, name: 'minimal required' },
    { block: full, name: 'full config' }
  ]

  const first = (block: Block, index: number): boolean =>
    index === runs.findIndex((other) => isDeepStrictEqual(other.block, block))

  return [
    new Scenario(pluginAlias, 'no config'),
    ...runs
      .filter(({ block }, index) => first(block, index))
      .map(({ block, name }) => new Scenario(pluginAlias, name, block)),
    new Scenario(pluginAlias, 'network resilience', full, true),
    new Shutdown(full)
  ]
}
