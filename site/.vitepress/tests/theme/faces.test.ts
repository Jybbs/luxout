import { readFile } from 'node:fs/promises'

import { expect, it } from 'vitest'

import { Tokens } from '../../lib/theme/tokens.ts'

const source = await readFile(new URL('../../theme/index.ts', import.meta.url), 'utf8')
const tokens = await Tokens.read(new URL('../../', import.meta.url))

it.for(['--luxout-font-display', '--vp-font-family-base', '--vp-font-family-mono'])(
  'imports the Fontsource sheet declaring the upright face %s opens on',
  async (token) => {
    const sheets = await Promise.all(source.matchAll(/^import '(@fontsource-variable\/[^']+)'$/gm)
      .map(([, name]) => readFile(new URL(import.meta.resolve(name!)), 'utf8')))
    const family = /^'[^']+'/.exec(tokens.resolve(token, 'light'))![0]

    expect(sheets.join('')).toContain(`font-family: ${family};\n  font-style: normal;`)
  }
)
