import { execFileSync } from 'node:child_process'
import { readdir }      from 'node:fs/promises'
import { join }         from 'node:path'

import { expect } from 'vitest'

import { plant, test } from '../../../common/scratch.js'
import { sync }        from '../../../common/sync.js'

const COPIED   = ['bun.lock', 'bunfig.toml', 'package.json']
const MANIFEST = JSON.stringify({ name: 'homebridge-luxout', version: '1.2.3' })
const RELEASES = ['floor', 'pinned']
const TAR      = [
  '--create', '--directory', 'packed', '--file', 'homebridge-luxout-1.2.3.tgz', '--gzip', 'package'
]
const CALLS = [
  ...RELEASES.map((release) => ['bun', 'install', '--cwd', `.cache/vet/${release}`, '--frozen-lockfile']),
  ['node', '.mise/vet/index.ts', '.cache/vet/plugins', '.cache/vet/floor', '.cache/vet/pinned']
]
const SEEDS = Object.fromEntries(RELEASES.flatMap((release) => COPIED.map((file) => [
  `tests/vet/${release}/${file}`,
  `${release} ${file}`
])))

test('unpacks the tarball, installs each release, and replays the scenarios under them', async ({
  scratch
}) => {
  await plant(scratch, {
    ...SEEDS,
    '.cache/vet/plugins/homebridge-luxout/stale.js' : '',
    'package.json'                                  : MANIFEST,
    'packed/package/dist/index.js'                  : 'export default () => {}\n',
    'packed/package/package.json'                   : MANIFEST
  })
  execFileSync('tar', TAR, { cwd: scratch })

  const { invoked, status } = await sync(scratch, 'plugin:vet', {
    canned: Object.fromEntries(CALLS.map((call) => [call.join(' '), {}]))
  })
  const plugin = join(scratch, '.cache', 'vet', 'plugins', 'homebridge-luxout')

  expect({
    calls    : invoked.map(({ args }) => args),
    floor    : await readdir(join(scratch, '.cache', 'vet', 'floor')),
    status   : status,
    unpacked : (await readdir(plugin, { recursive: true })).toSorted()
  }).toEqual({
    calls    : CALLS,
    floor    : COPIED,
    status   : 0,
    unpacked : ['dist', 'dist/index.js', 'package.json']
  })
})
