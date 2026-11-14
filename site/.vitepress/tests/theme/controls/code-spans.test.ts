/** @vitest-environment happy-dom */
import { expect } from 'vitest'
import { h }      from 'vue'

import { codeSpans } from '../../../theme/controls/code-spans.tsx'
import { test }      from '../../common/mount.ts'

test('sets each span between backticks as code and the words around it as text', ({ mount }) => {
  const host = mount(() => h('p', codeSpans('Reads `minutely_15` at a `15 min` step')))

  expect(host.querySelector('p')?.innerHTML).toBe(
    'Reads <code>minutely_15</code> at a <code>15 min</code> step'
  )
})
