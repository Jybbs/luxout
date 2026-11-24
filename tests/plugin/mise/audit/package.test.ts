import { expect, it } from 'vitest'

import { PackageManifest } from '../../../../.mise/audit/package.ts'

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
  const file = 'tests/plugin/homebridge/package.json'

  expect(manifest({ '@vitest/coverage-v8': '5.0.4', vitest: '5.0.3' }, file).findings)
    .toMatchObject([{ spot: { file, line: 3 }, title: 'Coverage pin' }])
})

it.each([
  '1.8.5', '2.0.0-alpha.21', '7.0.2007', '1.0.0+build.5'
])('reports nothing where every section pins the exact release %s', (pin) => {
  const sections = { dependencies: { a: pin }, devDependencies: { b: pin }, optionalDependencies: { c: pin } }

  expect(new PackageManifest(JSON.stringify(sections)).findings).toEqual([])
})

it.each([
  { pin: '^1.8.5', section: 'dependencies' },
  { pin: '~1.8.5', section: 'devDependencies' },
  { pin: '>=1.8.5', section: 'optionalDependencies' },
  { pin: '1.8', section: 'dependencies' },
  { pin: 'v1.8.5', section: 'dependencies' },
  { pin: '1.8.5 || 2.0.0', section: 'dependencies' },
  { pin: '*', section: 'dependencies' },
  { pin: 'latest', section: 'dependencies' },
  { pin: 'npm:homebridge@1.8.5', section: 'dependencies' },
  { pin: 'github:homebridge/homebridge', section: 'dependencies' },
  { pin: 1, section: 'dependencies' }
])('reports $pin under $section on the line of its name', ({ pin, section }) => {
  const text = JSON.stringify({ [section]: { homebridge: pin } }, null, 2)

  expect(new PackageManifest(text, 'tests/plugin/vet/floor/package.json').findings).toEqual([{
    message : `\`homebridge\` pins ${JSON.stringify(pin)} under \`${section}\`, which names no exact release`,
    spot    : { file: 'tests/plugin/vet/floor/package.json', line: 3 },
    title   : 'Exact pin'
  }])
})

it('reports nothing for a range outside the sections Bun installs from', () => {
  const text = JSON.stringify({ engines: { node: '^26.10.0' }, peerDependencies: { homebridge: '^2.0.0' } })

  expect(new PackageManifest(text).findings).toEqual([])
})

it.each([
  { held: '"^1.8.5"', what: 'a string' },
  { held: '["^1.8.5"]', what: 'a list' },
  { held: 'null', what: 'null' }
])('reports nothing for a dependencies section holding $what, which names no package', ({ held }) => {
  expect(new PackageManifest(`{ "dependencies": ${held} }`).findings).toEqual([])
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

it.each([
  { engines: { homebridge: '^1.8.5 || ^2.0.0' }, floor: '1.8.5' },
  { engines: { homebridge: '^2.0.0 || ^1.10.0 || ^1.8.5' }, floor: '1.8.5' },
  { engines: { homebridge: '>=1.8.0' }, floor: undefined },
  { engines: {}, floor: undefined }
])('reads $floor as the floor of the oldest line $engines.homebridge admits', ({ engines, floor }) => {
  expect(new PackageManifest(JSON.stringify({ engines })).homebridge).toBe(floor)
})

it.each([
  { devDependencies: { homebridge: '2.4.0' }, pin: '2.4.0' },
  { devDependencies: {}, pin: undefined }
])('reads the release $pin the devDependencies pin homebridge to', ({ devDependencies, pin }) => {
  expect(new PackageManifest(JSON.stringify({ devDependencies })).pin('homebridge')).toBe(pin)
})

it('reports a key the manifest names twice, which JSON.parse would take the last of', () => {
  const text = '{\n  "devDependencies": {},\n  "devDependencies": {}\n}\n'

  expect(new PackageManifest(text).findings).toMatchObject([{ spot: { line: 3 }, title: 'Parse error' }])
})

it('reports a manifest that fails to parse rather than throwing', () => {
  expect(new PackageManifest('{ "devDependencies": ').findings).toMatchObject([{ title: 'Parse error' }])
})
