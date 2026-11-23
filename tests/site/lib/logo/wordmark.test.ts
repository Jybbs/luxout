import { readFile } from 'node:fs/promises'

import { expect, it } from 'vitest'

import { CONSTRUCTION } from '../../../../site/.vitepress/lib/logo/construction.ts'
import { measure }      from '../../../../site/.vitepress/lib/logo/wordmark.ts'
import { FONT_FILES }   from '../../../../site/.vitepress/lib/type/typeface.ts'

const font = await readFile(new URL(`../../../${FONT_FILES.display}`, import.meta.url))

it('fails on a word with no o to draw as the sun', () => {
  expect(() => measure(font, { ...CONSTRUCTION, word: 'Lux' })).toThrow('holds no o')
})
