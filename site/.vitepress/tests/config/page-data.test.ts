import { expect, it } from 'vitest'

import manifest     from '../../../../package.json' with { type: 'json' }
import { setFacts } from '../../lib/config/page-data.ts'

it('sets the engines and the version package.json declares on a page, beside its own keys', () => {
  expect(setFacts(manifest)({ frontmatter: { title: 'Setup' } })).toEqual({
    frontmatter: { package: { engines: manifest.engines, version: manifest.version }, title: 'Setup' }
  })
})

it('carries a bumped version to every page', () => {
  const transform = setFacts({ engines: manifest.engines, version: '0.1.0' })
  const pages     = [{ frontmatter: {} }, { frontmatter: { layout: 'home' } }].map(transform)

  expect(pages.map(({ frontmatter }) => frontmatter.package.version)).toEqual(['0.1.0', '0.1.0'])
})

it('replaces a package key a page declares with the facts package.json declares', () => {
  expect(setFacts(manifest)({ frontmatter: { package: 'homebridge-luxout' } }).frontmatter.package)
    .toEqual({ engines: manifest.engines, version: manifest.version })
})
