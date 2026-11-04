/** @vitest-environment happy-dom */
import { expect } from 'vitest'
import { h }      from 'vue'

import { TableFold } from '../../../theme/controls/table-fold.ts'
import { test }      from '../../common/mount.ts'

test('folds its slot shut beneath the summary, leaving the table in the page', ({ mount }) => {
  const host    = mount(TableFold, { summary: 'As a table' }, () => h('table'))
  const details = host.querySelector('details')!

  expect(details.open).toBe(false)
  expect(details.querySelector('summary')!.textContent).toBe('As a table')
  expect(details.querySelector('table')).not.toBeNull()
})
