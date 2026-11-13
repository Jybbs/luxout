/** @vitest-environment happy-dom */
import { expect } from 'vitest'
import { h }      from 'vue'

import { layers } from '../../../theme/controls/layers.tsx'
import { test }   from '../../common/mount.ts'

test('shows the selected layer and marks every other one inert', ({ mount }) => {
  const host  = mount(() => layers([h('p', 'First'), h('p', 'Second')], 1))
  const shown = [...host.querySelectorAll<HTMLElement>('.layers > .layer')].map((layer) => [
    layer.textContent,
    layer.classList.contains('shown'),
    layer.inert
  ])

  expect(shown).toEqual([['First', false, true], ['Second', true, false]])
})
