import { fc, test }   from '@fast-check/vitest'
import { expect, it } from 'vitest'

import type { Finding }    from '../../../.mise/audit/finding.ts'
import { MiseConfig }      from '../../../.mise/audit/mise.ts'
import { PackageManifest } from '../../../.mise/audit/package.ts'

const ENGINES = '^22.23.3 || ^24.21.0 || ^26.10.0'

const audit = (engines: string | undefined, node: string): Finding[] =>
  new MiseConfig(`[tools]\nbun  = "1.4.2"\nnode = "${node}"\n`)
    .findings(new PackageManifest(JSON.stringify({ engines: { node: engines } })))

test.prop([fc.nat(), fc.nat()], { examples: [[0, 0]] })(
  'passes every Node release of the newest line at or above its floor',
  (minor, patch) => {
    expect(audit(ENGINES, `26.${10 + minor}.${patch}`)).toEqual([])
  }
)

it.each([
  { name: 'an older line engines admits', node: '24.21.0' },
  { name: 'the newest line below its floor', node: '26.9.9' },
  { name: 'a line past the newest engines admits', node: '27.0.0' }
])('holds the pin in [tools] on its own line inside ^26.10.0, rejecting $name', ({ node }) => {
  expect(audit(ENGINES, node)).toMatchObject([{
    message : `Node ${node} sits outside ^26.10.0, the newest line \`engines\` admits`,
    spot    : { file: '.mise/config.toml', line: 3 },
    title   : 'Node pin'
  }])
})

it('holds the pin to the newest line whatever order engines lists its ranges', () => {
  expect(audit('^26.10.0 || ^22.23.3 || ^24.21.0', '24.21.0')).toMatchObject([{
    message : 'Node 24.21.0 sits outside ^26.10.0, the newest line `engines` admits'
  }])
})

it.each([
  { engines: undefined, name: 'declares no Node range' },
  { engines: '>=22', name: 'names no caret range' }
])('reports the pin where engines $name', ({ engines }) => {
  expect(audit(engines, '26.10.0')).toMatchObject([{
    message : '`engines` admits no caret range for Node 26.10.0 to sit inside',
    title   : 'Node pin'
  }])
})

it('reports nothing where [tools] pins no Node', () => {
  expect(new MiseConfig('[tools]\nbun = "1.4.2"\n').findings(new PackageManifest('{}'))).toEqual([])
})

it('reports a config that fails to parse rather than throwing', () => {
  expect(new MiseConfig('[tools\n').findings(new PackageManifest('{}')))
    .toMatchObject([{ title: 'Parse error' }])
})
