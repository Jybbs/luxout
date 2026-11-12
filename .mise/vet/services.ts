import { readFile }      from 'node:fs/promises'
import { join }          from 'node:path'
import { pathToFileURL } from 'node:url'

import { HapClient } from '@homebridge/hap-client'
import type { AccessoryInformationProperties, CharacteristicType, ServiceType } from '@homebridge/hap-client'

import type { Settings }                    from '../../src/config/settings.ts'
import type { OUTSIDE }                     from '../../src/sensor/outside.ts'
import { type Block, type Homebridge, PIN } from './homebridge.ts'
import type * as scenario                   from './scenario.ts'

/**
 * One accessory the platform registers, the name and serial number it gives it
 * beside the type of the one service it adds.
 */
interface Registered {
  name    : string
  serial  : string
  service : string
}

const BRIDGE = 1  // The accessory ID HAP gives the bridge itself

/**
 * Holds one accessory a bridge exposes, as the services
 * `@homebridge/hap-client` reads off it, each carrying the accessory's
 * Accessory Information.
 */
class Accessory {
  readonly information : Record<string, unknown>
  readonly name        : string
  readonly services    : ServiceType[]

  constructor(services: ServiceType[]) {
    this.information = services[0]?.accessoryInformation
    this.name        = String(this.information.Name)
    this.services    = services
  }

  characteristic(type: string): CharacteristicType | undefined {
    return this.services.flatMap(({ serviceCharacteristics }) => serviceCharacteristics)
      .find((characteristic) => characteristic.type === type)
  }

  /**
   * Names each way the accessory differs from `registered`, meaning a service
   * other than the one it adds and Accessory Information other than what the
   * platform sets from `manifest`.
   */
  mismatches({ name, serial, service }: Registered, manifest: Plugin['manifest']): string[] {
    const exposed = this.services.map(({ type }) => type).join(' and ')
    const set     = {
      'Firmware Revision' : manifest.version,
      'Manufacturer'      : manifest.displayName,
      'Model'             : manifest.displayName,
      'Serial Number'     : serial
    } satisfies Partial<AccessoryInformationProperties>

    return [
      ...exposed === service ? [] : [`exposes ${exposed} on ${name} rather than ${service}`],
      ...Object.entries(set)
        .filter(([key, value]) => this.information[key] !== value)
        .map(([key, value]) =>
            `sets the ${key} of ${name} to ${String(this.information[key])} `
          + `rather than ${value}`)
    ]
  }
}

/**
 * Holds the accessories a bridge exposes over HAP by name, leaving out the
 * bridge itself.
 */
export class Exposure {
  readonly #accessories: Map<string, Accessory[]>

  /**
   * Reads every service the bridge listening on `port` at `127.0.0.1` exposes,
   * reading none where the bridge refuses the request. A bridge answers without
   * pairing only where Homebridge started insecure.
   */
  static async read(port: number): Promise<Exposure> {
    const client   = new HapClient({ config: { autoStartDiscovery: false }, logger: {}, pin: PIN })
    const instance = {
      configurationNumber   : 0,
      connectionFailedCount : 0,
      ipAddress             : '127.0.0.1',
      name                  : 'bridge',
      port                  : port,
      services              : [],
      username              : ''
    }

    try {
      return new Exposure(await client.getAllServices(instance))
    } finally {
      client.destroy()
    }
  }

  constructor(services: ServiceType[]) {
    const accessories = Map.groupBy(services.filter(({ aid }) => aid !== BRIDGE), ({ aid }) => aid)
      .values()
      .map((group) => new Accessory(group))

    this.#accessories = Map.groupBy(accessories, ({ name }) => name)
  }

  /**
   * Names each way the accessories differ from what the platform registers for
   * `block` from empty storage, as `plugin` reads it:
   *
   * - An accessory the platform registers no sensor for, an entry that fails
   *   validation among them, one it registers that the bridge leaves out, or
   *   one it registers that the bridge exposes more than once
   * - A mismatch `Accessory.mismatches` names
   * - A `CurrentAmbientLightLevel` on Outside outside the range its `props`
   *   declare
   * - An `OccupancyDetected` other than what the entry's levels decide for the
   *   reading Outside shows
   */
  differences(block: Block | undefined, plugin: Plugin): string[] {
    const { rejected, sensors, thresholds } = plugin.registers(block)
    const names                             = new Set(sensors.map(({ name }) => name))

    const exposed = (name: string): Accessory | undefined => this.#accessories.get(name)?.[0]
    const level   = exposed(plugin.outside.name)?.characteristic('CurrentAmbientLightLevel')
    const lux     = level?.value

    return [
      ...this.#accessories.entries().flatMap(([name, { length }]) => {
        if (rejected.has(name)) return [`exposes ${name}, whose entry fails validation`]
        if (!names.has(name)) return [`exposes ${name}, which the platform registers no sensor for`]

        return length === 1 ? [] : [`exposes ${length} accessories named ${name}`]
      }),
      ...sensors.flatMap((sensor) =>
        exposed(sensor.name)?.mismatches(sensor, plugin.manifest) ?? [`exposes no ${sensor.name} accessory`]),
      ...level === undefined ? [] : range(plugin.outside.name, level),
      ...thresholds.flatMap((entry) => {
        const state = exposed(entry.name)?.characteristic('OccupancyDetected')?.value

        if (typeof lux !== 'number' || state === undefined) return []
        if (entry.detects(state === 1, lux) === (state === 1)) return []

        return [`shows OccupancyDetected as ${String(state)} on ${entry.name} at ${lux} lux`]
      })
    ]
  }
}

/**
 * Holds what the comparison reads off the built plugin:
 *
 * - The `package.json` the platform reads its Accessory Information from
 * - The name and serial number of the Outside accessory
 * - The parser the platform reads its block through
 */
export class Plugin {
  readonly manifest : { displayName: string, version: string }
  readonly outside  : typeof OUTSIDE
  readonly settings : typeof Settings

  /**
   * Imports the parser and the Outside accessory from the plugin built under
   * `root`, beside the `package.json` it reads.
   */
  static async load(root: string): Promise<Plugin> {
    const built = async (...path: string[]): Promise<Record<string, unknown>> =>
      import(pathToFileURL(join(root, 'dist', ...path)).href)
    const [outside, settings, manifest] = await Promise.all([
      built('sensor', 'outside.js'),
      built('config', 'settings.js'),
      readFile(join(root, 'package.json'), 'utf8')
    ])

    return new Plugin(
      JSON.parse(manifest),
      outside.OUTSIDE as Plugin['outside'],
      settings.Settings as Plugin['settings']
    )
  }

  constructor(manifest: Plugin['manifest'], outside: Plugin['outside'], settings: Plugin['settings']) {
    this.manifest = manifest
    this.outside  = outside
    this.settings = settings
  }

  /**
   * Parses `block` as the platform does from empty storage, naming each sensor
   * it registers, each entry that fails validation, and each valid threshold
   * entry.
   */
  registers(block: Block | undefined) {
    const parsed = this.settings.parse(block)

    if (!parsed.ok) return { rejected: new Set<string>(), sensors: [], thresholds: [] }

    const { faults, thresholds } = parsed.value

    return {
      rejected   : new Set(faults.map(({ name }) => name)),
      thresholds : thresholds,
      sensors    : [
        { ...this.outside, service: 'LightSensor' },
        ...thresholds.map(({ name, serial }) => ({ name, serial, service: 'OccupancySensor' }))
      ]
    }
  }
}

/**
 * Starts Homebridge insecure and offline under the block the local run starts
 * with, and reads every accessory it exposes over HAP once the observe window
 * ends. The check fails where those accessories differ from what the platform
 * registers for the block.
 */
export class Services implements scenario.Check {
  readonly block   : Block | undefined
  readonly name    : string
  readonly #plugin : Plugin

  constructor(block: Block | undefined, plugin: Plugin) {
    this.block   = block
    this.name    = 'services over HAP'
    this.#plugin = plugin
  }

  async run(
    homebridge         : Homebridge,
    stage              : scenario.Stage,
    { grace, observe } : scenario.Tuning
  ): Promise<scenario.Verdict> {
    const run       = await homebridge.start({ ...stage, block: this.block, insecure: true, offline: true })
    const [started] = await Promise.all([run.started(observe), run.wait(observe)])
    const exposure  = started && !run.exited ? await Exposure.read(stage.port) : undefined

    await run.stop(grace)

    return {
      output   : run.output,
      failures : [
        ...exposure?.differences(this.block, this.#plugin) ?? ['never exposes its accessories over HAP'],
        ...run.faults
      ]
    }
  }
}

function range(name: string, level: CharacteristicType): string[] {
  const { maxValue = Infinity, minValue = -Infinity, value } = level

  if (typeof value === 'number' && value >= minValue && value <= maxValue) return []

  return [
      `shows ${String(value)} lux on ${name}, outside the ${minValue} to ${maxValue} lux range `
    + 'its props declare'
  ]
}
