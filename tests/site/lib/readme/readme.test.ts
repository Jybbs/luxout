import { existsSync }    from 'node:fs'
import { readFile }      from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { createMarkdownRenderer } from 'vitepress'
import { describe, expect, it }   from 'vitest'
import { renderToString }         from 'vue/server-renderer'

import manifest                       from '../../../../package.json' with { type: 'json' }
import { TWILIGHT }                   from '../../../../src/daylight/clear-sky.ts'
import config                         from '../../../../site/.vitepress/config.ts'
import * as credit                    from '../../../../site/.vitepress/lib/credit/credit.ts'
import { Seal, plaqueAddress }        from '../../../../site/.vitepress/lib/credit/seal.ts'
import { SampleDay }                  from '../../../../site/.vitepress/lib/daylight/sample-day.ts'
import { Logo, addressOf }            from '../../../../site/.vitepress/lib/logo/logo.ts'
import { DayPreview, previewAddress } from '../../../../site/.vitepress/lib/readme/day-preview.ts'
import * as startCards                from '../../../../site/.vitepress/lib/readme/start-cards.ts'
import { SCHEMES }                    from '../../../../site/.vitepress/lib/theme/tokens.ts'
import { dialDrawing } from '../../../../site/.vitepress/theme/components/daylight/dial-drawing.tsx'
import { vitepress }                  from '../../common/paths.ts'

const forms   = startCards.START_CARDS.flatMap((card) => SCHEMES.map((scheme) => ({ card, scheme })))
const cards   = await startCards.StartCards.read(vitepress)
const md      = await createMarkdownRenderer(fileURLToPath(new URL('../', vitepress)), config.markdown)
const preview = await DayPreview.read(vitepress, dialDrawing)
const seal    = await Seal.read(vitepress)
const logo    = await Logo.read(vitepress)
const readme  = await readFile(new URL('../../.github/README.md', vitepress), 'utf8')
const site    = (address: string) => new URL(`../public${address}`, vitepress)
const pages   = new Set(readme.matchAll(/(?:href="|\]\()(https:\/\/luxout\.fyi\/[^")]+)/g)
  .map(([, link]) => link!)
  .filter((link) => !/\.\w+$/.test(new URL(link).pathname)))

describe('the tracked README files', () => {
  it.for(SCHEMES)(
    'keep the %s preview at least 800 pixels wide, looping without end, and under 6 MB',
    async (scheme) => {
      const gif  = await readFile(site(previewAddress(scheme)))
      const loop = gif.indexOf('NETSCAPE2.0')  // Finds the identifier 13 bytes ahead of the loop count

      expect(gif.readUInt16LE(6)).toBeGreaterThanOrEqual(800)
      expect(loop).toBeGreaterThan(0)
      expect(gif.readUInt16LE(loop + 13)).toBe(0)
      expect(gif.length).toBeLessThan(6_000_000)
    }
  )

  it.for(forms)('hold the $scheme card $card.word as the site draws it', async ({ card, scheme }) => {
    await expect(`${await renderToString(cards.draw(card, scheme))}\n`)
      .toMatchFileSnapshot(site(startCards.cardAddress(card, scheme)).pathname)
  })

  it.for([
    { level: TWILIGHT.civil, word: 'Understand' },
    { level: TWILIGHT.sunset, word: 'Check' }
  ])('show the card $word at the morning’s first minute at $level degrees', ({ level, word }) => {
    const day    = SampleDay.record()
    const minute = startCards.START_CARDS.find((card) => card.word === word)!.minute(day)

    expect(minute).toBeLessThan(SampleDay.NOON)
    expect(day.altitudes[minute - 1]).toBeLessThan(level)
    expect(day.altitudes[minute]).toBeGreaterThanOrEqual(level)
  })

  it.for(SCHEMES)('hold the %s credit as the site draws it', async (scheme) => {
    await expect(`${await renderToString(seal.plaque(scheme))}\n`)
      .toMatchFileSnapshot(site(plaqueAddress(scheme)).pathname)
  })

  it('order the cards by the height of their sun, ending on noon', () => {
    const day     = SampleDay.record()
    const minutes = startCards.START_CARDS.map((card) => card.minute(day))
    const heights = minutes.map((minute) => day.altitudes[minute]!)

    expect(minutes.at(-1)).toBe(SampleDay.NOON)
    expect(heights).toEqual(heights.toSorted((a, b) => a - b))
  })
})

describe('the README', () => {
  it.for(SCHEMES)('shows the %s lockup and credit from luxout.fyi', (scheme) => {
    expect(readme).toContain(`${manifest.homepage}${addressOf('lockup', scheme)}`)
    expect(readme).toContain(`${manifest.homepage}${plaqueAddress(scheme)}`)
  })

  it('names the lockup in its alternative text as the drawing labels itself', () => {
    expect(readme).toContain(`alt="${logo.lockup('light').props!['aria-label']}"`)
  })

  it('names the credit in the plaque’s alternative text', () => {
    expect(readme).toContain(`alt="${credit.creditLabel()}"`)
  })

  it('sets out every row of the credit as a centered line, its label held to its value', () => {
    const lines = credit.creditRows().map(({ code, href, label, value }) =>
        `<code>${label.toUpperCase()}</code>&nbsp;${code ? `<code>${code}</code> ` : ''}`
      + (href ? `<a href="${href}">${value}</a>` : value)
    )

    expect(readme).toContain(`<p align="center">\n  ${lines.join('<br>\n  ')}\n</p>`)
  })

  it('names in its one Node badge the lowest line engines sets', () => {
    const lowest = Math.min(...manifest.engines.node.matchAll(/\^(\d+)/g).map(([, major]) => Number(major)))

    expect(readme.match(/img\.shields\.io\/badge\/LTS%20(\d+)%2B/)?.[1]).toBe(String(lowest))
    expect(readme).not.toContain('img.shields.io/node/')
  })

  it.for([
    ['Homebridge UI search', `search the plugins for \`${manifest.name}\``],
    ['hb-service command',   `\nsudo hb-service add ${manifest.name}\n`],
    ['npm badge’s link',     `<a href="https://www.npmjs.com/package/${manifest.name}">`],
    ['npm badge’s version',  `src="https://img.shields.io/npm/v/${manifest.name}?`]
  ] as const)('writes in the %s the name package.json declares', ([, text]) => {
    expect(readme).toContain(text)
  })

  it('describes the preview in its alternative text as the preview draws it', () => {
    expect(readme).toContain(`alt="${preview.alt}"`)
  })

  it.for(SCHEMES)('shows the %s preview from luxout.fyi', (scheme) => {
    expect(readme).toContain(`${manifest.homepage}${previewAddress(scheme)}`)
  })

  it.for(startCards.START_CARDS)('links the card $word to its page beside its own name', (card) => {
    expect(readme).toContain(`<a href="${startCards.pageAddress(card)}">`)
    expect(readme).toContain(`alt="${card.word}: ${cards.title(card)}"`)
  })

  it.for(forms)('shows the $scheme card $card.word from luxout.fyi', ({ card, scheme }) => {
    expect(readme).toContain(`${manifest.homepage}${startCards.cardAddress(card, scheme)}`)
  })

  it.for([...pages])('links %s to a page the site holds and any heading its fragment names', async (link) => {
    const { hash, pathname } = new URL(link)
    const page               = [`.${pathname}.md`, `.${pathname}index.md`]
      .map((file) => new URL(file, new URL('../', vitepress)))
      .find(existsSync)

    expect(page).toBeDefined()

    const html = md.render(await readFile(page!, 'utf8'), {})
    const ids  = html.matchAll(/<h[1-6][^>]* id="([^"]+)"/g).map(([, id]) => id)

    expect(['', ...ids]).toContain(hash.slice(1))
  })
})
