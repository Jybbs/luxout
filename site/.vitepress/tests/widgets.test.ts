import { glob, readFile } from 'node:fs/promises'
import { join }           from 'node:path'

import { formatHex, interpolate, wcagContrast } from 'culori'
import { cross, min }                           from 'd3-array'
import postcss, { type Root }                   from 'postcss'
import { expect, it }                           from 'vitest'

import { WIDGET_NAMES } from '../lib/widgets/placements.ts'

/**
 * The widths a container query may name, each where a widget reflows inside its
 * column.
 */
const CONTAINER_WIDTHS = new Set(['30rem', '38rem'])
const GROUNDS          = [{ name: 'light', selector: ':root' }, { name: 'dark', selector: '.dark' }]
/**
 * The widths a media query may name, each one of VitePress's own breakpoints.
 */
const MEDIA_WIDTHS = new Set(['40rem', '48rem', '60rem'])
const theme        = join(import.meta.dirname, '..', 'theme')
const paths        = await Array.fromAsync(glob('**/*.css', { cwd: theme }))
const texts        = await Promise.all(paths.map((path) => readFile(join(theme, path), 'utf8')))
const sheet        = postcss.parse(texts.join('\n'))
const vars         = new URL(import.meta.resolve('vitepress/dist/client/theme-default/styles/vars.css'))
const palette      = postcss.parse(await readFile(vars, 'utf8'))
const framing      = new URL('../lib/daylight/the-gap-frame.css', import.meta.url)
const frame        = postcss.parse(await readFile(framing, 'utf8'))

function declared(root: Root, property: string, selector: string): string[] {
  const values: string[] = []

  root.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return

    rule.walkDecls(property, ({ value }) => {
      values.push(value)
    })
  })

  return values
}

function fallback(name: string): string {
  return /#\w+/.exec(declared(sheet, name, '.widget')[0]!)![0]
}

function mixed(ground: string, ink: string, property: string, selector: string): string {
  const [mix] = declared(sheet, property, selector)

  return formatHex(interpolate([ground, ink], 'rgb')(Number(/(\d+)%/.exec(mix!)![1]) / 100))
}

function resolved(name: string, selector: string): string {
  const value = declared(palette, name, selector).at(-1) ?? ''
  const chain = /^var\((--[\w-]+)\)$/.exec(value)

  return chain ? resolved(chain[1]!, selector) : value
}

function token(name: string, selector: string): string {
  return resolved(/--vp[\w-]+/.exec(declared(sheet, name, '.widget')[0]!)![0], selector)
}

function widths(name: 'container' | 'media'): Set<string> {
  const found = new Set<string>()

  sheet.walkAtRules(name, ({ params }) => {
    const [, width] = /width\D*([\d.]+\w+)/.exec(params) ?? []

    if (width) found.add(width)
  })

  return found
}

it('names each container query at a width from the one declared set', () => {
  expect(widths('container').difference(CONTAINER_WIDTHS)).toEqual(new Set())
})

it('names each media query at a width from VitePress’s breakpoints', () => {
  expect(widths('media').difference(MEDIA_WIDTHS)).toEqual(new Set())
})

it('styles no widget’s root inside a container query, which reads the width of an ancestor', () => {
  const roots = new Set(WIDGET_NAMES.map((name) => `.${name.replaceAll(/\B[A-Z]/g, '-$&').toLowerCase()}`))
  const found: string[] = []

  sheet.walkAtRules('container', (query) => {
    query.walkRules(({ selector }) => {
      if (roots.has(selector)) found.push(selector)
    })
  })

  expect(found).toEqual([])
})

it('writes no color-mix toward black, which the minifier folds into another color', () => {
  const found: string[] = []

  sheet.walkDecls(({ value }) => {
    if (/color-mix\([^)]*\bblack\b/.test(value)) found.push(value)
  })

  expect(found).toEqual([])
})

it.each(GROUNDS)('holds the widget’s text at 4.5:1 on each surface of the $name ground', ({ selector }) => {
  const color    = (name: string) => token(name, selector)
  const inks     = ['--widget-ink', '--widget-muted'].map(color)
  const surfaces = ['--widget-ground', '--widget-raised', '--widget-sunken'].map(color)

  expect(min(cross(inks, surfaces, wcagContrast))).toBeGreaterThanOrEqual(4.5)
})

it.each(GROUNDS)('holds the replayed field’s line at 3:1 on the $name ground', ({ selector }) => {
  const color = (name: string) => token(name, selector)
  const line  = mixed(color('--widget-raised'), color('--widget-muted'), '--page-line', '.location-search')
  const edges = cross([line], ['--widget-ground', '--widget-raised'].map(color), wcagContrast)

  expect(min(edges)).toBeGreaterThanOrEqual(3)
})

it.each(GROUNDS)('holds the estimate’s color at 3:1 on the $name ground', ({ selector }) => {
  const ground = token('--widget-ground', selector)

  expect(wcagContrast(fallback('--widget-estimate'), ground)).toBeGreaterThanOrEqual(3)
})

it.each([
  { floor: 4.5, property: 'fill', selector: '.the-gap-word' },
  { floor: 4.5, property: 'fill', selector: '.the-gap-figure' },
  { floor: 3, property: 'stroke', selector: '.the-gap-edge' },
  { floor: 3, property: 'stroke', selector: '.the-gap-reading' }
])('holds $selector in the frame at $floor:1 on each ground', ({ floor, property, selector }) => {
  const inks  = declared(frame, property, selector)
  const worst = min(declared(frame, 'background', '.the-gap-drawing'), (ground, index) =>
    wcagContrast(inks[index] ?? inks[0]!, ground)
  )

  expect(worst).toBeGreaterThanOrEqual(floor)
})

it.each(['.the-gap-band', '.the-gap-on'])('tints %s in the frame as the sheet mixes it', (selector) => {
  const tints = declared(frame, 'background', '.the-gap-drawing').map((ground) =>
    mixed(ground, fallback('--widget-sensor'), 'fill', selector)
  )

  expect(declared(frame, 'fill', selector)).toEqual(tints)
})
