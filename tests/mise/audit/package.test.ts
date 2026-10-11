import { expect, it } from 'vitest'

import { PackageManifest } from '../../../.mise/audit/package.ts'

const manifest = (devDependencies: object, file?: string): PackageManifest =>
  new PackageManifest(JSON.stringify({ devDependencies, engines: { node: '^26.10.0' } }, null, 2), file)

it.each([
  { devDependencies: { '@vitest/coverage-v8': '5.0.3', vitest: '5.0.3' }, name: 'the two pins match' },
  { devDependencies: { vitest: '5.0.3' }, name: 'the coverage provider is not declared' }
])('reports nothing where $name', ({ devDependencies }) => {
  expect(manifest(devDependencies).findings).toEqual([])
})

it.each([
  {
    devDependencies : { '@vitest/coverage-v8': '5.0.4', vitest: '5.0.3' },
    message         : '`@vitest/coverage-v8` pins 5.0.4, whereas `vitest`, the release it runs under, '
                    + 'pins 5.0.3',
    name            : 'another release'
  },
  {
    devDependencies : { '@vitest/coverage-v8': '5.0.4' },
    message         : '`@vitest/coverage-v8` pins 5.0.4, whereas `vitest`, the release it runs under, '
                    + 'pins nothing',
    name            : 'no release'
  }
])('reports @vitest/coverage-v8 on its own line where vitest pins $name', ({ devDependencies, message }) => {
  expect(manifest(devDependencies).findings).toMatchObject([
    { message, spot: { file: 'package.json', line: 3 }, title: 'Coverage pin' }
  ])
})

it('reports a coverage pin against the file the manifest was read from', () => {
  expect(manifest({ '@vitest/coverage-v8': '5.0.4', vitest: '5.0.3' }, 'site/package.json').findings)
    .toMatchObject([{ spot: { file: 'site/package.json', line: 3 }, title: 'Coverage pin' }])
})

it.each([
  { engines: { node: '^22.23.3 || ^24.21.0 || ^26.10.0' }, floors: ['22.23.3', '24.21.0', '26.10.0'] },
  { engines: { node: '>=22' }, floors: [] },
  { engines: {}, floors: [] }
])('reads the floors $floors from the caret ranges engines admits', ({ engines, floors }) => {
  expect(new PackageManifest(JSON.stringify({ engines })).floors).toEqual(floors)
})

it.each([
  { floor: '22.23.3', release: '22.0.0' },
  { floor: '24.21.0', release: '24.21.0' },
  { floor: undefined, release: '20.19.0' }
])('reads $floor as the floor engines sets for the line Node $release sits on', ({ floor, release }) => {
  expect(new PackageManifest(JSON.stringify({ engines: { node: '^22.23.3 || ^24.21.0' } })).floor(release))
    .toBe(floor)
})

it('reports a key the manifest names twice, which JSON.parse would take the last of', () => {
  const text = '{\n  "devDependencies": {},\n  "devDependencies": {}\n}\n'

  expect(new PackageManifest(text).findings).toMatchObject([{ spot: { line: 3 }, title: 'Parse error' }])
})

it('reports a manifest that fails to parse rather than throwing', () => {
  expect(new PackageManifest('{ "devDependencies": ').findings).toMatchObject([{ title: 'Parse error' }])
})
