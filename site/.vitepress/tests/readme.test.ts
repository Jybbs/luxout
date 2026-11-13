import { existsSync }          from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath }       from 'node:url'

import { createMarkdownRenderer } from 'vitepress'
import { describe, expect, it }   from 'vitest'
import { renderToString }         from 'vue/server-renderer'

import manifest                       from '../../../package.json' with { type: 'json' }
import config                         from '../config.ts'
import { SampleDay }                  from '../lib/daylight/sample-day.ts'
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

  it.for(SCHEMES)('keep the %s preview at least 800 pixels wide, looping, and under 6 MB', async (scheme) => {
    const gif = await readFile(site(previewAddress(scheme)))

    expect(gif.readUInt16LE(6)).toBeGreaterThanOrEqual(800)
    expect(gif.indexOf('NETSCAPE2.0')).toBeGreaterThan(0)
    expect(gif.length).toBeLessThan(6_000_000)
  })

  it.for(forms)('hold the $scheme card $card.word as the site draws it', async ({ card, scheme }) => {
    await expect(`${await renderToString(cards.draw(card, scheme))}\n`)
      .toMatchFileSnapshot(site(startCards.cardAddress(card, scheme)).pathname)
  })

  it('show the card Check at the first minute past noon the sun sits below -6 degrees', () => {
    const day    = SampleDay.record()
    const minute = startCards.START_CARDS.find(({ word }) => word === 'Check')!.minute(day)

    expect(minute).toBeGreaterThan(SampleDay.NOON)
    expect(day.altitudes[minute - 1]).toBeGreaterThanOrEqual(-6)
    expect(day.altitudes[minute]).toBeLessThan(-6)
  })
})

describe('the README', () => {
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

  it.for([...pages])('links %s to a page and a heading the site holds', async (link) => {
    const { hash, pathname } = new URL(link)
    const page               = [`.${pathname}.md`, `.${pathname}index.md`]
      .map((file) => new URL(file, new URL('../', root)))
      .find(existsSync)

    expect(page).toBeDefined()

    const ids = md.render(await readFile(page!, 'utf8'), {}).matchAll(/ id="([^"]+)"/g).map(([, id]) => id)

    expect(['', ...ids]).toContain(hash.slice(1))
  })
})
