import { existsSync }          from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath }       from 'node:url'

import { createMarkdownRenderer } from 'vitepress'
import { describe, expect, it }   from 'vitest'
import { renderToString }         from 'vue/server-renderer'

import manifest                       from '../../../package.json' with { type: 'json' }
import { TWILIGHT }                   from '../../../src/daylight/clear-sky.ts'
import config                         from '../config.ts'
import * as credit                    from '../lib/credit/credit.ts'
import { Seal, plaqueAddress }        from '../lib/credit/seal.ts'
import { SampleDay }                  from '../lib/daylight/sample-day.ts'
import { Logo, addressOf }            from '../lib/logo/logo.ts'
import { DayPreview, previewAddress } from '../lib/readme/day-preview.ts'
import * as startCards                from '../lib/readme/start-cards.ts'
import { SCHEMES }                    from '../lib/theme/tokens.ts'
import { dialDrawing }                from '../theme/components/daylight/dial-drawing.tsx'

declare module 'vitest' {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
    toMatchFileBytes(path: URL): Promise<void>
  }
}

const RECORDING = 600_000  // The milliseconds one scheme's recording may take
const forms     = startCards.START_CARDS.flatMap((card) => SCHEMES.map((scheme) => ({ card, scheme })))
const root      = new URL('../', import.meta.url)
const cards     = await startCards.StartCards.read(root)
const md        = await createMarkdownRenderer(fileURLToPath(new URL('../', root)), config.markdown)
const preview   = await DayPreview.read(root, dialDrawing)
const seal      = await Seal.read(root)
const logo      = await Logo.read(root)
const readme    = await readFile(new URL('../../.github/README.md', root), 'utf8')
const site      = (address: string) => new URL(`../public${address}`, root)
const pages     = new Set(readme.matchAll(/(?:href="|\]\()(https:\/\/luxout\.fyi\/[^")]+)/g)
  .map(([, link]) => link!)
  .filter((link) => !/\.\w+$/.test(new URL(link).pathname)))

expect.extend({
  async toMatchFileBytes(received: Uint8Array, path: URL) {
    if (this.snapshotState.snapshotUpdateState === 'all') await writeFile(path, received)

    const pass = Buffer.from(received).equals(await readFile(path))

    return {
      message : () => `${path.pathname} ${pass ? 'holds' : 'no longer holds'} the bytes the site writes`,
      pass    : pass
    }
  }
})

describe('the tracked README files', () => {
  it.for(SCHEMES)('hold the %s preview as the site records it', { timeout: RECORDING }, async (scheme) => {
    await expect(await preview.record(scheme)).toMatchFileBytes(site(previewAddress(scheme)))
  })

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
      .map((file) => new URL(file, new URL('../', root)))
      .find(existsSync)

    expect(page).toBeDefined()

    const html = md.render(await readFile(page!, 'utf8'), {})
    const ids  = html.matchAll(/<h[1-6][^>]* id="([^"]+)"/g).map(([, id]) => id)

    expect(['', ...ids]).toContain(hash.slice(1))
  })
})
