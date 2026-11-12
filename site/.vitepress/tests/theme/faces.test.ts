import { readFile } from 'node:fs/promises'

import { parse }      from 'postcss'
import { expect, it } from 'vitest'

import { Tokens } from '../../lib/theme/tokens.ts'

const source = await readFile(new URL('../../theme/index.ts', import.meta.url), 'utf8')
const tokens = await Tokens.read(new URL('../../', import.meta.url))

it.for([
  { axis: 'opsz', token: '--luxout-font-display' },
  { axis: 'opsz', token: '--vp-font-family-base' },
  { axis: 'wght', token: '--vp-font-family-mono' }
])(
  'imports the Fontsource sheet setting the upright face $token opens on along its $axis axis',
  async ({ axis, token }) => {
    const sheets = await Promise.all(source.matchAll(/^import '(@fontsource-variable\/[^']+)'$/gm)
      .map(([, name]) => readFile(new URL(import.meta.resolve(name!)), 'utf8')))
    const faces  = sheets.flatMap((sheet) => parse(sheet).nodes
      .filter((node) => node.type === 'atrule')
      .filter(({ name }) => name === 'font-face')
      .map((face) => Object.fromEntries(face.nodes!
        .filter((node) => node.type === 'decl')
        .map(({ prop, value }) => [prop, value]))))
    const family = /^'[^']+'/.exec(tokens.resolve(token, 'light'))![0]

    expect(faces).toContainEqual(expect.objectContaining({
      'font-family' : family,
      'font-style'  : 'normal',
      'src'         : expect.stringMatching(new RegExp(`-${axis}-normal\\.woff2\\)`))
    }))
  }
)
