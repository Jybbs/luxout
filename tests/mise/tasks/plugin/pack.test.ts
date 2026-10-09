import { spawnSync }             from 'node:child_process'
import { cp, readFile, readdir } from 'node:fs/promises'
import { delimiter, join }       from 'node:path'

import { expect } from 'vitest'

import { plant, test } from '../../../common/scratch.js'

const MANIFEST = {
  files   : ['dist/'],
  license : 'MIT',
  main    : 'dist/index.js',
  name    : 'luxout-fixture',
  type    : 'module',
  version : '1.2.3'
}
const root    = join(import.meta.dirname, '..', '..', '..', '..')
const PACKAGE = {
  '.github/README.md' : '# Fixture\n',
  'dist/index.js'     : 'export default () => {}\n',
  'package.json'      : JSON.stringify(MANIFEST)
}
const task = join(root, '.mise', 'tasks', 'plugin', 'pack')

async function pack(files: Record<string, string>, scratch: string, tmpdir = scratch) {
  await plant(scratch, files)

  const path = [join(scratch, 'bin'), join(root, '.mise', 'bin'), process.env.PATH].join(delimiter)

  const { status, stderr, stdout } = spawnSync(task, {
    cwd      : scratch,
    encoding : 'utf8',
    env      : {
      ...process.env,
      PATH                       : path,
      TMPDIR                     : tmpdir,
      npm_config_cache           : join(scratch, '.npm'),
      npm_config_offline         : 'true',
      npm_config_update_notifier : 'false'
    }
  })

  return { status, stderr, stdout }
}

test('copies the README to the root, prints the files, and imports the package', async ({ scratch }) => {
  const { status, stdout } = await pack(PACKAGE, scratch)

  expect({ readme: await readFile(join(scratch, 'README.md'), 'utf8'), status, stdout }).toEqual({
    readme : '# Fixture\n',
    status : 0,
    stdout : expect.stringMatching(/^README\.md\ndist\/index\.js\npackage\.json\n/)
  })
}, 60_000)

test('makes the directory it installs the tarball into under TMPDIR', async ({ scratch }) => {
  const tmpdir = join(scratch, 'file')

  const { status, stderr } = await pack({ ...PACKAGE, file: '' }, scratch, tmpdir)

  expect({ status, stderr }).toEqual({ status: 1, stderr: expect.stringContaining(tmpdir) })
}, 60_000)

test('removes the directory it installs the tarball into', async ({ scratch }) => {
  await pack(PACKAGE, scratch)

  expect((await readdir(scratch)).filter((entry) => entry.startsWith('tmp.'))).toEqual([])
}, 60_000)

test('installs the tarball without running its install scripts', async ({ scratch }) => {
  const manifest = JSON.stringify({ ...MANIFEST, scripts: { postinstall: 'exit 1' } })

  const { status } = await pack({ ...PACKAGE, 'package.json': manifest }, scratch)

  expect(status).toBe(0)
}, 60_000)

test('fails a package whose main imports a file the tarball leaves out', async ({ scratch }) => {
  const files = {
    ...PACKAGE,
    'dist/index.js' : "export { default } from '../lib/plugin.js'\n",
    'lib/plugin.js' : 'export default () => {}\n'
  }

  const { status, stderr } = await pack(files, scratch)

  expect({ status, stderr }).toEqual({ status: 1, stderr: expect.stringContaining('ERR_MODULE_NOT_FOUND') })
}, 60_000)

test.for([
  { key: 'repository', value: 'https://example.com/luxout' },
  { key: 'types', value: 'dist/index.d.ts' }
])('fails where publint reports pkg.$key', { timeout: 60_000 }, async ({ key, value }, { scratch }) => {
  const manifest = JSON.stringify({ ...MANIFEST, [key]: value })

  const { status, stdout } = await pack({ ...PACKAGE, 'package.json': manifest }, scratch)

  expect({ status, stdout }).toEqual({ status: 1, stdout: expect.stringContaining(`pkg.${key}`) })
})

test('fails a tarball whose files leave out README.md', async ({ scratch }) => {
  await cp(join(import.meta.dirname, '..', '..', 'fixtures', 'npm.sh'), join(scratch, 'bin', 'npm'))

  expect(await pack(PACKAGE, scratch)).toEqual({
    status : 1,
    stderr : 'The tarball holds no README.md, so npm shows no README for the package\n',
    stdout : 'package.json\n'
  })
})
