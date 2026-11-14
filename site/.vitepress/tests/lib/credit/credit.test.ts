import { readFile } from 'node:fs/promises'

import { expect, it } from 'vitest'

import * as credit from '../../../lib/credit/credit.ts'

const bib    = await readFile(new URL('../../../../references.bib', import.meta.url), 'utf8')
const page   = await readFile(new URL('../../../../estimate/bibliography.md', import.meta.url), 'utf8')
const client = await readFile(new URL('../../../../../src/weather/client.ts', import.meta.url), 'utf8')

it('holds the Bibliography page’s Credits section to the record', () => {
  const rows = credit.creditRows().map(({ code, href, label, value }) =>
    `| ${label} | ${code ? `\`${code}\` ` : ''}${href ? `[${value}](${href})` : value} |`
  )

  expect(page).toContain(
      `## Credits\n\n*${credit.CREDIT.lede}*\n\n`
    + `| **Field** | **Credit** |\n|---|---|\n${rows.join('\n')}\n`
  )
})

it('holds the record to the forecast’s entry in the bibliography', () => {
  const entry  = /@software\{zippenfenig2024,([^@]+)/.exec(bib)![1]!
  const field  = (name: string) => new RegExp(`${name}\\s*=\\s*\\{([^}]+)\\}`).exec(entry)?.[1]
  const [last] = field('author')!.split(',')

  expect({ doi: field('doi'), publisher: field('publisher'), surname: last, year: Number(field('year')) }).toEqual({
    doi       : credit.CREDIT.doi,
    publisher : credit.CREDIT.publisher,
    surname   : credit.CREDIT.creator.split(' ').at(-1),
    year      : credit.CREDIT.year
  })
})

it('names the field of the forecast the plugin requests', () => {
  expect(/minutely_15\s*:\s*'(\w+)'/.exec(client)?.[1]).toBe(credit.CREDIT.variable)
})

it('letters the rim with the creator’s surname over the year and the license', () => {
  expect(credit.creditRim()).toEqual({ bottom: '2024 · CC BY 4.0', top: 'ZIPPENFENIG' })
})

it('writes the whole credit as the one sentence its image is labeled with', () => {
  expect(credit.creditLabel()).toBe(
      'Credits. The forecast behind every reading, and the terms it is shared under. '
    + 'Weather data by Open-Meteo.com, Patrick Zippenfenig, Zenodo, 2024, CC BY 4.0.'
  )
})
