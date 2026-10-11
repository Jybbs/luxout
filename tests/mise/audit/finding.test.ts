import { fc, test }   from '@fast-check/vitest'
import { expect, it } from 'vitest'

import { Finding } from '../../../.mise/audit/finding.ts'

const ANNOTATION = /^::error file=(?<file>[^,]*),line=(?<line>\d+),title=(?<title>[^:]*)::(?<message>.*)$/s
const text       = fc.string({ unit: 'binary-ascii' })

it.each([
  {
    annotation : '::error file=package.json,line=40,title=Coverage pin::Pins: 5.0.3, 5.0.4',
    finding    : new Finding('Pins: 5.0.3, 5.0.4', { file: 'package.json', line: 40 }, 'Coverage pin'),
    name       : 'leaves `:` and `,` in the message as written'
  },
  {
    annotation : '::error file=a%2Cb%3Ac.toml,line=1,title=Pin%3A Node%2C 26::100%25%0Dof%0Alines',
    finding    : new Finding('100%\rof\nlines', { file: 'a,b:c.toml', line: 1 }, 'Pin: Node, 26'),
    name       : 'encodes `%`, `\\r`, and `\\n` throughout, and `:` and `,` in the file and the title'
  }
])('$name', ({ annotation, finding }) => {
  expect(finding.annotation).toBe(annotation)
})

test.prop([text, fc.nat(), text, text])(
  'round-trips every file, line, message, and title through the runner’s decoding',
  (file, line, message, title) => {
    const { groups = {} } = ANNOTATION.exec(new Finding(message, { file, line }, title).annotation) ?? {}

    expect(Object.fromEntries(Object.entries(groups).map(([key, part]) => [key, decodeURIComponent(part)])))
      .toEqual({ file, line: String(line), message, title })
  }
)
