import { expect, it } from 'vitest'

import { PackageManifest } from '../../../.mise/audit/package.ts'
import { VetManifests }    from '../../../.mise/audit/vet.ts'

const PINS     = { floor: '1.8.5', pinned: '2.4.0' }
const manifest = new PackageManifest(JSON.stringify({
  devDependencies : { homebridge: '2.4.0' },
  engines         : { homebridge: '^2.0.0 || ^1.8.5' }
}))

/**
 * Holds a manifest under `tests/vet/<role>` pinning each release `pins` names,
 * with the pin on line 3.
 */
const vet = (pins: Record<string, string | undefined>): VetManifests => new VetManifests(Object.fromEntries(
  Object.entries(pins).map(([role, pin]) => [
    `tests/vet/${role}/package.json`,
    JSON.stringify({ dependencies: pin === undefined ? {} : { homebridge: pin } }, null, 2)
  ])
))

it('reports nothing where each manifest pins the release its source names', () => {
  expect(vet(PINS).findings(manifest)).toEqual([])
})

it.each([
  {
    message : '`homebridge` pins 1.8.4, whereas `engines.homebridge` sets its floor at 1.8.5',
    pins    : { floor: '1.8.4' }
  },
  {
    message : '`homebridge` pins 2.3.1, whereas the `homebridge` devDependency pins 2.4.0',
    pins    : { pinned: '2.3.1' }
  }
])('reports a pin its source has moved past on its own line', ({ message, pins }) => {
  const [role] = Object.keys(pins)

  expect(vet({ ...PINS, ...pins }).findings(manifest)).toMatchObject([
    { message, spot: { file: `tests/vet/${role}/package.json`, line: 3 }, title: 'Vet pin' }
  ])
})

it('reports a manifest that pins no release on its first line', () => {
  expect(vet({ ...PINS, pinned: undefined }).findings(manifest)).toMatchObject([{
    message : '`homebridge` pins nothing, whereas the `homebridge` devDependency pins 2.4.0',
    spot    : { file: 'tests/vet/pinned/package.json', line: 1 }
  }])
})

it('reports a source that names no release', () => {
  expect(vet(PINS).findings(new PackageManifest('{}'))).toMatchObject([
    { message: '`homebridge` pins 1.8.5, whereas `engines.homebridge` sets its floor at nothing' },
    { message: '`homebridge` pins 2.4.0, whereas the `homebridge` devDependency pins nothing' }
  ])
})

it('reports a manifest a source holds a release for that the checkout lacks', () => {
  expect(vet({ pinned: '2.4.0' }).findings(manifest)).toMatchObject([{
    message : '`tests/vet/floor/package.json` is missing, '
            + 'whereas `engines.homebridge` sets its floor at 1.8.5',
    spot    : { file: 'tests/vet/floor/package.json', line: 1 },
    title   : 'Vet pin'
  }])
})

it('reports a manifest under a directory no source is named for', () => {
  expect(vet({ ...PINS, latest: '2.4.0' }).findings(manifest)).toMatchObject([{
    message : '`tests/vet/latest` names no source its `homebridge` pin follows, '
            + 'since only `floor` and `pinned` name one',
    spot    : { file: 'tests/vet/latest/package.json', line: 1 }
  }])
})

it('reports a manifest that fails to parse rather than throwing', () => {
  const files = {
    'tests/vet/floor/package.json'  : '{ "dependencies": ',
    'tests/vet/pinned/package.json' : JSON.stringify({ dependencies: { homebridge: '2.4.0' } })
  }

  expect(new VetManifests(files).findings(manifest)).toMatchObject([
    { title: 'Parse error' },
    { title: 'Vet pin' }
  ])
})
