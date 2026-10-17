import { readFile } from 'node:fs/promises'
import { join }     from 'node:path'

import { expect, it } from 'vitest'

import { Bibliography } from '../../../lib/citations/bibliography.ts'

const fixture      = join(import.meta.dirname, 'fixtures', 'references.bib')
const bibliography = Bibliography.parse(await readFile(fixture, 'utf8'))
const notes        = new Bibliography(new Map([['first', 'The first work.'], ['second', 'The second work.']]))

it.each([
  {
    key  : 'hufkens2023',
    name : 'names the first of four or more authors and sets a journal’s volume, issue, and article number',
    note : 'Hufkens et al. 2023. "Evaluating the effects of moonlight on the vertical flight profiles of '
         + 'three western palaearctic swifts." *Proceedings of the Royal Society B* 290 (2010): '
         + '20230957. <https://doi.org/10.1098/rspb.2023.0957>'
  },
  {
    key  : 'janiczek1987',
    name : 'italicizes a book’s title, names its series and number, and links its URL in place of a DOI',
    note : 'Janiczek and DeYoung. 1987. *Computer Programs for Sun and Moon Illuminance With Contingent '
         + 'Tables and Diagrams*. U.S. Naval Observatory Circular 171. '
         + '<https://archive.org/details/DTIC_ADA182110>'
  },
  {
    key  : 'reda2008',
    name : 'joins two authors with and, and names a report’s institution and number',
    note : 'Reda and Andreas. 2008. "Solar Position Algorithm for Solar Radiation Applications (Revised)." '
         + 'National Renewable Energy Laboratory, NREL/TP-560-34302. <https://doi.org/10.2172/15003974>'
  },
  {
    key  : 'reno2012',
    name : 'joins three authors with a serial comma',
    note : 'Reno, Hansen, and Stein. 2012. "Global Horizontal Irradiance Clear Sky Models: Implementation '
         + 'and Analysis." Sandia National Laboratories, SAND2012-2389. <https://doi.org/10.2172/1039404>'
  },
  {
    key  : 'zippenfenig2023',
    name : 'names one author and the publisher of a piece of software',
    note : 'Zippenfenig. 2023. "Open-Meteo.com Weather API." Zenodo. <https://doi.org/10.5281/zenodo.7970649>'
  }
])('$name', ({ key, note }) => {
  expect(bibliography.cite(`Bright[^${key}].\n`)).toBe(`Bright[^${key}].\n\n[^${key}]: ${note}\n`)
})

it('names an organization written in double braces as its author', () => {
  const bibtex = '@software{geonames, author = {{GeoNames}}, title = {T}, publisher = {P}, year = {2026}, '
               + 'url = {u}}'

  expect(Bibliography.parse(bibtex).cite('One[^geonames].\n'))
    .toBe('One[^geonames].\n\n[^geonames]: GeoNames. 2026. "T." P. <u>\n')
})

it('shortens exactly four authors to the first', () => {
  const bibtex = '@software{four, author = {One, A and Two, B and Three, C and Four, D}, title = {T}, '
               + 'publisher = {P}, year = {2026}, url = {u}}'

  expect(Bibliography.parse(bibtex).cite('One[^four].\n'))
    .toBe('One[^four].\n\n[^four]: One et al. 2026. "T." P. <u>\n')
})

it('writes each work once, in the order the page first cites it, a blank line apart', () => {
  expect(notes.cite('One[^second], two[^first], again[^second].\n')).toBe(
      'One[^second], two[^first], again[^second].\n\n'
    + '[^second]: The second work.\n\n[^first]: The first work.\n'
  )
})

it('cites two works whose markers sit side by side', () => {
  expect(notes.cite('Both[^first][^second].\n')).toBe(
      'Both[^first][^second].\n\n'
    + '[^first]: The first work.\n\n[^second]: The second work.\n'
  )
})

it('keeps a marker a colon follows mid-sentence, since a definition opens a line of its own', () => {
  expect(notes.cite('One[^first]: its gist.\n')).toBe('One[^first]: its gist.\n\n[^first]: The first work.\n')
})

it('changes nothing on a page it already wrote', () => {
  const page = notes.cite('One[^second], two[^first].\n')

  expect(notes.cite(page)).toBe(page)
})

it('replaces the footnote text a page holds with the text the bibliography gives', () => {
  expect(notes.cite('One[^first].\n\n[^first]: Stale.\n')).toBe('One[^first].\n\n[^first]: The first work.\n')
})

it('drops the footnote of a work the page no longer cites', () => {
  expect(notes.cite('One.\n\n[^first]: The first work.\n')).toBe('One.\n')
})

it('leaves a page that cites nothing as it reads', () => {
  expect(notes.cite('# Luxout\n\nNo citations.\n')).toBe('# Luxout\n\nNo citations.\n')
})

it('fails naming a key the bibliography holds no entry for', () => {
  expect(() => notes.cite('One[^third].\n')).toThrow('The bibliography holds no entry for third')
})

it('fails naming an entry whose type no footnote template formats', () => {
  expect(() => Bibliography.parse('@thesis{kept, author = {Kept, Al}, title = {T}, year = {2020}}'))
    .toThrow('kept is an entry of type thesis, which no footnote template formats')
})

it.each([
  { entry: 'author = {A, B}, year = {2026}', field: 'address', missing: 'neither a DOI nor a URL' },
  { entry: 'year = {2026}, url = {u}',       field: 'authors', missing: 'no author' },
  { entry: 'author = {A, B}, url = {u}',     field: 'year',    missing: 'no year' }
])('fails naming the $field an entry holding $missing leaves out', ({ entry, field }) => {
  expect(() => Bibliography.parse(`@software{bare, ${entry}, title = {T}, publisher = {P}}`))
    .toThrow(`bare leaves out the ${field} its footnote template reads`)
})

it('fails naming the field an entry leaves out', () => {
  const bibtex = '@article{short, author = {Short, Al}, title = {T}, journal = {J}, year = {2020}}'

  expect(() => Bibliography.parse(bibtex)).toThrow('short leaves out the volume its footnote template reads')
})
