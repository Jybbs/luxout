import { spawnSync }                     from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir }                        from 'node:os'
import { dirname, join }                 from 'node:path'

import { test as base, expect, vi } from 'vitest'

import { Bundle } from '../../../lib/bundle/bundle.ts'

const CLEAN = {
  '.vitepress/dist/assets/app.js'       : 'export const a=1;',
  '.vitepress/dist/assets/style.css'    : '.a{color:color-mix(in srgb, var(--a) 30%, black)}'
                                        + 'img[src$="/logo.svg"]{width:1px}',
  '.vitepress/dist/index.html'          : '<!doctype html><html><body><img src="/logo.svg"></body></html>',
  '.vitepress/theme/styles/widgets.css' : '.a {\n  color: color-mix(in srgb, var(--a) 30%, black);\n}\n'
}
const entry = join(import.meta.dirname, '..', '..', '..', 'lib', 'bundle', 'index.ts')
const test  = base.extend('root', async ({ onTestFinished }) => {
  const root = await mkdtemp(join(tmpdir(), 'luxout-'))

  onTestFinished(() => rm(root, { force: true, recursive: true }))
  await plant(root, CLEAN)

  return root
})
  .extend('write', () => vi.fn<(line: string) => void>())

async function plant(root: string, files: Record<string, string>): Promise<void> {
  await Promise.all(Object.entries(files).map(async ([file, text]) => {
    await mkdir(dirname(join(root, file)), { recursive: true })
    await writeFile(join(root, file), text)
  }))
}

test('writes nothing and returns 0 for a build carrying no defect', async ({ root, write }) => {
  expect(await Bundle.read(root).report(write)).toBe(0)
  expect(write).not.toHaveBeenCalled()
})

test('passes a built image rule an element on any one page matches', async ({ root, write }) => {
  await plant(root, {
    '.vitepress/dist/assets/chunks/hero.css' : '.hero img[src$="/sun.png"]{width:1px}',
    '.vitepress/dist/guide/index.html'       : '<img src="/sun.png">'
  })

  expect(await Bundle.read(root).report(write)).toBe(0)
  expect(write).not.toHaveBeenCalled()
})

test('passes a kept color-mix() whose literal color the minifier shortens', async ({ root, write }) => {
  await plant(root, {
    '.vitepress/dist/assets/chunks/hero.css'      : '.hero{color:color-mix(in srgb, var(--a) 50%, #fff)}',
    '.vitepress/theme/components/styles/hero.css' : '.hero { color: color-mix(in srgb, var(--a) 50%, '
                                                  + '#FFFFFF) }'
  })

  expect(await Bundle.read(root).report(write)).toBe(0)
  expect(write).not.toHaveBeenCalled()
})

test('passes a kept color-mix() whose light-dark() the build’s targets lower', async ({ root, write }) => {
  await plant(root, {
    '.vitepress/dist/assets/chunks/hero.css'      : '.hero{color:color-mix(in srgb, var(--a) 30%, '
                                                  + 'var(--lightningcss-light,#fff) '
                                                  + 'var(--lightningcss-dark,#000))}',
    '.vitepress/theme/components/styles/hero.css' : '.hero { color: color-mix(in srgb, var(--a) 30%, '
                                                  + 'light-dark(#fff, #000)) }'
  })

  expect(await Bundle.read(root).report(write)).toBe(0)
  expect(write).not.toHaveBeenCalled()
})

test('writes on one line a folded color-mix() the theme spreads across lines', async ({ root, write }) => {
  await plant(root, {
    '.vitepress/theme/components/styles/hero.css' : '.hero {\n  color: color-mix(\n    in srgb,\n'
                                                  + '    red 30%,\n    black\n  );\n}\n'
  })

  expect(await Bundle.read(root).report(write)).toBe(1)
  expect(write.mock.calls.flat()).toEqual([
    '.vitepress/theme/components/styles/hero.css: the minifier folds color-mix(in srgb, red 30%, black) into '
    + 'a fixed color'
  ])
})

test('reads no stylesheet outside the theme as a source', async ({ root, write }) => {
  await plant(root, {
    '.vitepress/lib/daylight/frame.css': '.a { color: color-mix(in srgb, red 30%, black) }'
  })

  expect(await Bundle.read(root).report(write)).toBe(0)
  expect(write).not.toHaveBeenCalled()
})

test('reports a build that wrote no page, rather than passing it', async ({ root, write }) => {
  expect(await Bundle.read(join(root, '.vitepress', 'theme')).report(write)).toBe(1)
  expect(write.mock.calls.flat()).toEqual(['.vitepress/dist: holds no page to inspect'])
})

test('writes one line per defect, naming the file each sits in, and returns 1', async ({ root, write }) => {
  await plant(root, {
    '.vitepress/dist/assets/chunks/hero.css'      : '.hero img[src$="/sun.png"]{width:1px}',
    '.vitepress/dist/assets/chunks/node.js'       : 'var $=X(((e,t)=>{t.exports={}}));',
    '.vitepress/dist/guide/index.html'            : '<img src="/assets/sun.Bx1a2c.png">',
    '.vitepress/theme/components/styles/hero.css' : '.hero { color: color-mix(in srgb, red 30%, black) }'
  })

  expect(await Bundle.read(root).report(write)).toBe(1)
  expect(write.mock.calls.flat()).toEqual([
    '.vitepress/dist/assets/chunks/node.js: carries the empty module Vite builds in place of a Node built-in',
    '.vitepress/dist/assets/chunks/hero.css: [src$="/sun.png"] matches no element on any page',
    '.vitepress/theme/components/styles/hero.css: the minifier folds color-mix(in srgb, red 30%, black) into '
    + 'a fixed color'
  ])
})

test('runs under Node’s type stripping and exits 1 on what it writes', async ({ root }) => {
  await plant(root, { '.vitepress/dist/assets/node.js': 'var $=X(((e,t)=>{t.exports={}}));' })

  const { status, stdout } = spawnSync(process.execPath, [entry], { cwd: root, encoding: 'utf8' })

  expect({ status, stdout }).toEqual({
    status : 1,
    stdout : '.vitepress/dist/assets/node.js: carries the empty module Vite builds in place of a Node '
           + 'built-in\n'
  })
}, 30_000)
