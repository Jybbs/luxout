import { once }             from 'node:events'
import { createServer }     from 'node:http'
import type { AddressInfo } from 'node:net'
import { join }             from 'node:path'

import { Characteristics, Services as Types } from '@homebridge/hap-client/hap-types'
import * as hap                               from '@homebridge/hap-nodejs'
import { expect, it }                         from 'vitest'

import * as services                              from '../../../.mise/vet/services.ts'
import { Settings }                               from '../../../src/config/settings.js'
import { OUTSIDE }                                from '../../../src/sensor/outside.js'
import { plant }                                  from '../../common/scratch.js'
import { type Acts, TUNING, install, stage, test } from '../../common/vet.js'

/**
 * One characteristic HAP-NodeJS sends, named by the key `Characteristics`
 * holds for its type.
 */
interface Sent {
  type      : string
  value     : unknown
  maxValue? : number
  minValue? : number
}

const BLOCK = {
  latitude   : 42.36,
  longitude  : -71.06,
  platform   : 'Luxout',
  thresholds : [{ name: 'Dark Outside' }, { name: 'Dusk', offLux: 50, onLux: 50 }]
}
const BRIDGE = accessory(1, 'Luxout', 'ProtocolInformation', [{ type: 'Version', value: '1.1.0' }])
const PLUGIN = new services.Plugin({ displayName: 'Luxout', version: '1.2.3' }, OUTSIDE, Settings)

/**
 * Builds one accessory as HAP-NodeJS sends it under `/accessories`, its
 * Accessory Information naming Luxout, the version `PLUGIN` reads, and the
 * serial number the platform gives `name`, each overridden by `information`.
 */
function accessory(
  aid             : number,
  name            : string,
  service         : string,
  characteristics : Sent[],
  information     : Record<string, string> = {}
) {
  const set = {
    FirmwareRevision : '1.2.3',
    Manufacturer     : 'Luxout',
    Model            : 'Luxout',
    Name             : name,
    SerialNumber     : name === OUTSIDE.name ? OUTSIDE.serial : `luxout-threshold-${name}`,
    ...information
  }
  const sent = (iid: number, { type, ...rest }: Sent) => ({
    description : type.replaceAll(/(?<=[a-z])(?=[A-Z])/g, ' '),
    format      : typeof rest.value === 'string' ? 'string' : 'float',
    iid         : iid,
    perms       : ['pr', 'ev'],
    type        : Reflect.get(Characteristics, type),
    ...rest
  })

  return {
    aid      : aid,
    services : [
      {
        characteristics : Object.entries(set).map(([type, value], index) => sent(index + 2, { type, value })),
        iid             : 1,
        type            : Types.AccessoryInformation
      },
      {
        characteristics : characteristics.map((characteristic, index) => sent(index + 10, characteristic)),
        iid             : 9,
        type            : Reflect.get(Types, service)
      }
    ]
  }
}

function outside(lux: number, information?: Record<string, string>) {
  const { maxValue, minValue } = new hap.Characteristic.CurrentAmbientLightLevel().props
  const level                  = { maxValue, minValue, type: 'CurrentAmbientLightLevel', value: lux }

  return accessory(2, 'Outside', 'LightSensor', [level], information)
}

function sensor(aid: number, name: string, detected: number, information?: Record<string, string>) {
  const occupancy = { type: 'OccupancyDetected', value: detected }

  return accessory(aid, name, 'OccupancySensor', [occupancy], information)
}

/**
 * Reads the accessories a stand-in bridge answers `/accessories` with, as
 * `status` and `accessories`, through `Exposure.read`.
 */
async function exposure(accessories: unknown[], status = 200): Promise<services.Exposure> {
  const server = createServer((_, response) =>
    response.writeHead(status).end(JSON.stringify({ accessories })))

  await once(server.listen(0, '127.0.0.1'), 'listening')

  try {
    return await services.Exposure.read((server.address() as AddressInfo).port)
  } finally {
    server.close()
  }
}

it('passes the accessories the platform registers for the block, leaving out the bridge', async () => {
  const exposed = await exposure([BRIDGE, outside(38609), sensor(3, 'Dark Outside', 0)])

  expect(exposed.differences(BLOCK, PLUGIN)).toEqual([])
})

it.for([
  {
    accessories : [outside(38609), sensor(3, 'Dark Outside', 0), sensor(4, 'Dusk', 0)],
    failure     : 'exposes Dusk, whose entry fails validation'
  },
  {
    accessories : [outside(38609), sensor(3, 'Dark Outside', 0), sensor(4, 'Porch', 0)],
    failure     : 'exposes Porch, which the platform registers no sensor for'
  },
  {
    accessories : [outside(38609)],
    failure     : 'exposes no Dark Outside accessory'
  },
  {
    accessories : [outside(38609), sensor(3, 'Dark Outside', 0), sensor(4, 'Dark Outside', 0)],
    failure     : 'exposes 2 accessories named Dark Outside'
  },
  {
    accessories : [sensor(2, 'Outside', 0), sensor(3, 'Dark Outside', 0)],
    failure     : 'exposes OccupancySensor on Outside rather than LightSensor'
  },
  {
    accessories : [outside(38609), sensor(2, 'Outside', 0), sensor(3, 'Dark Outside', 0)],
    failure     : 'exposes LightSensor and OccupancySensor on Outside rather than LightSensor'
  },
  {
    accessories : [outside(38609), sensor(3, 'Dark Outside', 0, { Model: 'Lamp' })],
    failure     : 'sets the Model of Dark Outside to Lamp rather than Luxout'
  },
  {
    accessories : [outside(38609, { FirmwareRevision: '0.0.1' }), sensor(3, 'Dark Outside', 0)],
    failure     : 'sets the Firmware Revision of Outside to 0.0.1 rather than 1.2.3'
  },
  {
    accessories : [outside(200000), sensor(3, 'Dark Outside', 0)],
    failure     : 'shows 200000 lux on Outside, outside the 0.0001 to 100000 lux range its props declare'
  },
  {
    accessories : [outside(1), sensor(3, 'Dark Outside', 0)],
    failure     : 'shows OccupancyDetected as 0 on Dark Outside at 1 lux'
  },
  {
    accessories : [outside(38609), sensor(3, 'Dark Outside', 1)],
    failure     : 'shows OccupancyDetected as 1 on Dark Outside at 38609 lux'
  }
])('fails a bridge that $failure', async ({ accessories, failure }) => {
  expect((await exposure([BRIDGE, ...accessories])).differences(BLOCK, PLUGIN)).toEqual([failure])
})

it.for([0, 1])('holds a threshold sensor showing %i inside the gap between its levels', async (detected) => {
  const exposed = await exposure([outside(100), sensor(3, 'Dark Outside', detected)])

  expect(exposed.differences(BLOCK, PLUGIN)).toEqual([])
})

it('registers no accessory for a block that fails to parse', async () => {
  const exposed = await exposure([BRIDGE, outside(38609)])

  expect(exposed.differences({ platform: 'Luxout' }, PLUGIN))
    .toEqual(['exposes Outside, which the platform registers no sensor for'])
})

it('reads no accessory from a bridge that refuses an unpaired controller', async () => {
  const exposed = await exposure([outside(38609), sensor(3, 'Dark Outside', 0)], 470)

  expect(exposed.differences(BLOCK, PLUGIN))
    .toEqual(['exposes no Outside accessory', 'exposes no Dark Outside accessory'])
})

test('reads the manifest, the Outside accessory, and the parser off the plugin built under the root', async ({
  scratch
}) => {
  await plant(scratch, {
    'dist/config/settings.js' : 'export class Settings {}\n',
    'dist/sensor/outside.js'  : `export const OUTSIDE = ${JSON.stringify(OUTSIDE)}\n`,
    'package.json'            : JSON.stringify(PLUGIN.manifest)
  })

  const plugin = await services.Plugin.load(scratch)

  expect({ manifest: plugin.manifest, name: plugin.settings.name, outside: plugin.outside }).toEqual({
    manifest : PLUGIN.manifest,
    name     : 'Settings',
    outside  : OUTSIDE
  })
})

test.concurrent.for<{ acts: Acts, failures: string[] }>([
  { acts: { accessories: [outside(38609), sensor(3, 'Dark Outside', 0)] }, failures: [] },
  { acts: { accessories: [outside(38609)] }, failures: ['exposes no Dark Outside accessory'] },
  { acts: { mute: true }, failures: ['never exposes its accessories over HAP'] }
])('reads a bridge it starts insecure and offline, failing $failures', async ({ acts, failures }, {
  expect,
  scratch
}) => {
  const check      = new services.Services(BLOCK, PLUGIN)
  const homebridge = await install(join(scratch, 'release'))
  const verdict    = await check.run(homebridge, await stage(scratch, acts), TUNING)

  expect({
    failures : verdict.failures,
    insecure : verdict.output.includes('--strict-plugin-resolution -I'),
    offline  : verdict.output.includes('offline.ts')
  }).toEqual({ failures, insecure: true, offline: true })
})
