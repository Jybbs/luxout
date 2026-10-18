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
         + 'three western palaearctic swifts." *Proceedings of the Royal Society B: Biological Sciences* '
         + '290 (2010): 20230957. <https://doi.org/10.1098/rspb.2023.0957>'
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

it('keeps the particle written before a family name', () => {
  const bibtex = '@software{silva, author = {da Silva, Luis and van der Linden, Ann}, title = {T}, '
               + 'publisher = {P}, year = {2026}, url = {u}}'

  expect(Bibliography.parse(bibtex).cite('One[^silva].\n'))
    .toBe('One[^silva].\n\n[^silva]: da Silva and van der Linden. 2026. "T." P. <u>\n')
})

it('shortens a list BibTeX ends on others to the first author', () => {
  const bibtex = '@software{others, author = {Hufkens, Koen and Meier, Christoph and others}, title = {T}, '
               + 'publisher = {P}, year = {2026}, url = {u}}'

  expect(Bibliography.parse(bibtex).cite('One[^others].\n'))
    .toBe('One[^others].\n\n[^others]: Hufkens et al. 2026. "T." P. <u>\n')
})

it('links the DOI of an entry holding both a DOI and a URL', () => {
  const bibtex = '@software{both, author = {A, B}, title = {T}, publisher = {P}, year = {2026}, '
               + 'doi = {10.1/x}, url = {u}}'

  expect(Bibliography.parse(bibtex).cite('One[^both].\n'))
    .toBe('One[^both].\n\n[^both]: A. 2026. "T." P. <https://doi.org/10.1/x>\n')
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

it('lifts a mid-page note with its indented lines, leaving one blank line between paragraphs', () => {
  expect(notes.cite('One[^first].\n\n[^first]: Stale\n    and continued.\n\nTwo.\n'))
    .toBe('One[^first].\n\nTwo.\n\n[^first]: The first work.\n')
})

it('keeps apart the paragraphs around a note that interrupts one', () => {
  expect(notes.cite('One[^first].\n[^first]: Stale.\n\nTwo.\n'))
    .toBe('One[^first].\n\nTwo.\n\n[^first]: The first work.\n')
})

it.each([
  {
    cited : 'One[^first].\n\n    [^first]: Code.\n\n[^first]: The first work.\n',
    name  : 'keeps a definition indented by four spaces, which reads as code',
    page  : 'One[^first].\n\n    [^first]: Code.\n'
  },
  {
    cited : 'One[^first].\n\n[^first]: The first work.\n',
    name  : 'lifts a continuation line indented by a tab',
    page  : 'One[^first].\n\n[^first]: Stale\n\tand continued.\n'
  },
  {
    cited : 'One[^first].\n\n[^first]: The first work.\n',
    name  : 'lifts a continuation line indented by spaces and then a tab',
    page  : 'One[^first].\n\n[^first]: Stale\n  \tand continued.\n'
  },
  {
    cited : 'One[^first].\n\nTwo.\n\n[^first]: The first work.\n',
    name  : 'lifts an indented paragraph continuing the note after a blank line',
    page  : 'One[^first].\n\n[^first]: Stale.\n\n    More.\n\nTwo.\n'
  },
  {
    cited : 'One[^first].\n\nTwo.\n\n[^first]: The first work.\n',
    name  : 'lifts an indented paragraph after a blank line holding only spaces',
    page  : 'One[^first].\n\n[^first]: Stale.\n  \n    More.\n\nTwo.\n'
  },
  {
    cited : 'One[^first].\n\n  Two.\n\n[^first]: The first work.\n',
    name  : 'keeps a paragraph indented by fewer than four spaces after a note',
    page  : 'One[^first].\n\n[^first]: Stale.\n\n  Two.\n'
  }
])('$name', ({ cited, page }) => {
  expect(notes.cite(page)).toBe(cited)
})

it('replaces a note indented by up to three spaces', () => {
  expect(notes.cite('One[^first].\n\n   [^first]: Stale.\n'))
    .toBe('One[^first].\n\n[^first]: The first work.\n')
})

it('cites a key holding capitals and punctuation', () => {
  const keyed = new Bibliography(new Map([['Reda-2008:spa', 'The work.']]))

  expect(keyed.cite('One[^Reda-2008:spa].\n\n[^Reda-2008:spa]: Stale.\n'))
    .toBe('One[^Reda-2008:spa].\n\n[^Reda-2008:spa]: The work.\n')
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
  { entry: 'author = {A, B}, year = {2026}', field: 'address', missing: 'no DOI or URL' },
  { entry: 'author = {, John}, year = {2026}, url = {u}', field: 'authors', missing: 'a nameless author' },
  {
    entry   : 'author = {A, B and , John}, year = {2026}, url = {u}',
    field   : 'authors',
    missing : 'a nameless second author'
  },
  { entry: 'year = {2026}, url = {u}', field: 'authors', missing: 'no author' },
  { entry: 'author = {A, B}, url = {u}', field: 'year', missing: 'no year' }
])('fails naming the $field an entry holding $missing leaves out', ({ entry, field }) => {
  expect(() => Bibliography.parse(`@software{bare, ${entry}, title = {T}, publisher = {P}}`))
    .toThrow(`bare leaves out the ${field} its footnote template reads`)
})

it('fails naming the field an entry leaves out', () => {
  const bibtex = '@article{short, author = {Short, Al}, title = {T}, journal = {J}, year = {2020}}'

  expect(() => Bibliography.parse(bibtex)).toThrow('short leaves out the volume its footnote template reads')
})
