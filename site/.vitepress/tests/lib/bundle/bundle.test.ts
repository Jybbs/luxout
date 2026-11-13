import { spawnSync } from 'node:child_process'
import { join }      from 'node:path'

import { expect, vi } from 'vitest'

import { Bundle }                 from '../../../lib/bundle/bundle.ts'
import { plant, test as scratch } from '../../common/scratch.ts'

const CLEAN = {
  '.vitepress/dist/assets/app.js'      : 'export const a=1;',
  '.vitepress/dist/assets/style.css'   : '@layer vitepress{img[src$="/logo.svg"]{width:1px}}'
                                       + '@layer utilities{@container (width>=38rem){'
                                       + '.a{color:color-mix(in srgb, var(--a) 30%, #fff)}}}'
                                       + ':root{--a:red}',
  '.vitepress/dist/index.html'         : '<!doctype html><html><body><img src="/logo.svg"></body></html>',
  '.vitepress/theme/styles/tokens.css' : '@theme {\n  --container-*: initial;\n'
                                       + '  --container-md: 38rem;\n}\n\n'
                                       + ':root {\n  --a: red;\n}\n\n'
                                       + '.a {\n  color: color-mix(in srgb, var(--a) 30%, #fff);\n}\n'
}
const entry = join(import.meta.dirname, '..', '..', '..', 'lib', 'bundle', 'index.ts')
const test  = scratch
  .extend('root', async ({ scratch: root }) => {
    await plant(root, CLEAN)

    return root
  })
  .extend('write', () => vi.fn<(line: string) => void>())

test('writes nothing and returns 0 for a build carrying no defect', async ({ root, write }) => {
  expect(await (await Bundle.read(root)).report(write)).toBe(0)
  expect(write).not.toHaveBeenCalled()
})

test('passes a built image rule an element on any one page matches', async ({ root, write }) => {
  await plant(root, {
    '.vitepress/dist/assets/chunks/hero.css' : '@layer utilities{.hero img[src$="/sun.png"]{width:1px}}',
    '.vitepress/dist/guide/index.html'       : '<img src="/sun.png">'
  })

  expect(await (await Bundle.read(root)).report(write)).toBe(0)
  expect(write).not.toHaveBeenCalled()
})

test('passes a kept color-mix() whose literal color the minifier shortens', async ({ root, write }) => {
  await plant(root, {
    '.vitepress/dist/assets/chunks/hero.css'      : '@layer utilities{'
                                                  + '.hero{color:color-mix(in srgb, var(--a) 50%, #fff)}}',
    '.vitepress/theme/components/styles/hero.css' : '.hero { color: color-mix(in srgb, var(--a) 50%, '
                                                  + '#FFFFFF) }'
  })

  expect(await (await Bundle.read(root)).report(write)).toBe(0)
  expect(write).not.toHaveBeenCalled()
})

test('passes a kept color-mix() whose light-dark() the build’s targets lower', async ({ root, write }) => {
  await plant(root, {
    '.vitepress/dist/assets/chunks/hero.css'      : '@layer utilities{'
                                                  + '.hero{color:color-mix(in srgb, var(--a) 30%, '
                                                  + 'var(--lightningcss-light,#fff) '
                                                  + 'var(--lightningcss-dark,#000))}}',
    '.vitepress/theme/components/styles/hero.css' : '.hero { color: color-mix(in srgb, var(--a) 30%, '
                                                  + 'light-dark(#fff, #000)) }'
  })

  expect(await (await Bundle.read(root)).report(write)).toBe(0)
  expect(write).not.toHaveBeenCalled()
})

test('writes on one line a folded color-mix() the theme spreads across lines', async ({ root, write }) => {
  await plant(root, {
    '.vitepress/theme/components/styles/hero.css' : '.hero {\n  color: color-mix(\n    in srgb,\n'
                                                  + '    red 30%,\n    black\n  );\n}\n'
  })

  expect(await (await Bundle.read(root)).report(write)).toBe(1)
  expect(write.mock.calls.flat()).toEqual([
    '.vitepress/theme/components/styles/hero.css: the minifier folds color-mix(in srgb, red 30%, black) into '
    + 'a fixed color'
  ])
})

test('reports a folded color-mix() a class of the theme’s sources writes as an arbitrary value', async ({
  root,
  write
}) => {
  await plant(root, {
    '.vitepress/theme/components/dim.tsx' : 'export const Dim = () => '
                                          + '<p class="bg-[color-mix(in_srgb,red_30%,black)]" />',
    '.vitepress/theme/styles/dim.css'     : '@tailwind utilities source(none);\n\n@source \'..\';\n'
  })

  expect(await (await Bundle.read(root)).report(write)).toBe(1)
  expect(write.mock.calls.flat()).toEqual([
    '.vitepress/theme/styles/dim.css: the minifier folds color-mix(in srgb,red 30%,black) into a fixed color'
  ])
})

test('scans the whole site for a theme stylesheet that declares no source', async ({ root, write }) => {
  await plant(root, {
    '.vitepress/theme/components/dim.tsx' : 'export const Dim = () => '
                                          + '<p class="bg-[color-mix(in_srgb,red_30%,black)]" />',
    '.vitepress/theme/styles/dim.css'     : '@tailwind utilities;\n'
  })

  expect(await (await Bundle.read(root)).report(write)).toBe(1)
  expect(write.mock.calls.flat()).toEqual([
    '.vitepress/theme/styles/dim.css: the minifier folds color-mix(in srgb,red 30%,black) into a fixed color'
  ])
})

test('reads no stylesheet outside the theme as a source', async ({ root, write }) => {
  await plant(root, {
    '.vitepress/lib/daylight/frame.css': '.a { color: color-mix(in srgb, red 30%, black) }'
  })

  expect(await (await Bundle.read(root)).report(write)).toBe(0)
  expect(write).not.toHaveBeenCalled()
})

test('reports a stylesheet naming another layer ahead of the default theme’s', async ({ root, write }) => {
  await plant(root, { '.vitepress/dist/assets/chunks/late.css': '@layer theme,vitepress;' })

  expect(await (await Bundle.read(root)).report(write)).toBe(1)
  expect(write.mock.calls.flat()).toEqual([
    '.vitepress/dist/assets/chunks/late.css: names the theme layer ahead of vitepress'
  ])
})

test('reports a property set outside every layer that no rule of the theme sets there', async ({
  root,
  write
}) => {
  await plant(root, {
    '.vitepress/dist/assets/chunks/nav.css': '.VPNav{color:red}@media (hover:hover){:root{--b:red}}'
  })

  expect(await (await Bundle.read(root)).report(write)).toBe(1)
  expect(write.mock.calls.flat()).toEqual([
    '.vitepress/dist/assets/chunks/nav.css: .VPNav { color } sits outside every layer',
    '.vitepress/dist/assets/chunks/nav.css: :root { --b } sits outside every layer'
  ])
})

test('reads the frames of a keyframes rule and each rule beneath a layer as layered', async ({
  root,
  write
}) => {
  await plant(root, {
    '.vitepress/dist/assets/chunks/turn.css': '@keyframes turn{to{rotate:1turn}}'
                                            + '@layer utilities{@media (hover:hover){.a:hover{color:red}}}'
  })

  expect(await (await Bundle.read(root)).report(write)).toBe(0)
  expect(write).not.toHaveBeenCalled()
})

test('reports a query outside the default theme’s layer naming a width the theme declares none of', async ({
  root,
  write
}) => {
  await plant(root, {
    '.vitepress/dist/assets/chunks/wide.css': '@layer vitepress{@media (min-width:640px){.VPNav{color:red}}}'
                                            + '@layer utilities{@container not (width>=37rem){.a{color:red}}'
                                            + '@media (width>=48rem){.b{color:red}}}'
  })

  expect(await (await Bundle.read(root)).report(write)).toBe(1)
  expect(write.mock.calls.flat()).toEqual([
    '.vitepress/dist/assets/chunks/wide.css: a container query names 37rem, a width the theme declares '
    + 'none of',
    '.vitepress/dist/assets/chunks/wide.css: a media query names 48rem, a width the theme declares none of'
  ])
})

test('reports a color set to a number outside the default theme’s layer', async ({ root, write }) => {
  await plant(root, {
    '.vitepress/dist/assets/chunks/zero.css': '@layer vitepress{.VPNav{color:0}}'
                                            + '@layer utilities{@container (width<38rem){.a{color:0}}}'
  })

  expect(await (await Bundle.read(root)).report(write)).toBe(1)
  expect(write.mock.calls.flat()).toEqual([
    '.vitepress/dist/assets/chunks/zero.css: .a { color: 0 } sets a color to a number'
  ])
})

test('reports a color-mix() toward black outside the default theme’s layer', async ({ root, write }) => {
  await plant(root, {
    '.vitepress/dist/assets/chunks/dim.css': '@layer vitepress{.VPNav{color:color-mix(in srgb, red 30%, '
                                           + 'black)}}@layer utilities{'
                                           + '.a{color:color-mix(in srgb, var(--a) 30%, black)}}'
  })

  expect(await (await Bundle.read(root)).report(write)).toBe(1)
  expect(write.mock.calls.flat()).toEqual([
    '.vitepress/dist/assets/chunks/dim.css: color-mix(in srgb, var(--a) 30%, black) mixes toward black'
  ])
})

test('reports a build that wrote no page, rather than passing it', async ({ root, write }) => {
  expect(await (await Bundle.read(join(root, '.vitepress', 'theme'))).report(write)).toBe(1)
  expect(write.mock.calls.flat()).toEqual(['.vitepress/dist: holds no page to inspect'])
})

test('writes one line per defect, naming the file each sits in, and returns 1', async ({ root, write }) => {
  await plant(root, {
    '.vitepress/dist/assets/chunks/hero.css'      : '@layer utilities{.hero img[src$="/sun.png"]{width:1px}}',
    '.vitepress/dist/assets/chunks/node.js'       : 'var $=X(((e,t)=>{t.exports={}}));',
    '.vitepress/dist/guide/index.html'            : '<img src="/assets/sun.Bx1a2c.png">',
    '.vitepress/theme/components/styles/hero.css' : '.hero { color: color-mix(in srgb, red 30%, black) }'
  })

  expect(await (await Bundle.read(root)).report(write)).toBe(1)
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
