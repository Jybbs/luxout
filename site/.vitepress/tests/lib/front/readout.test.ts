/** @vitest-environment happy-dom */
import { beforeEach, expect, it } from 'vitest'

import type { Facts } from '../../../lib/front/facts.ts'
import { Readout }    from '../../../lib/front/readout.ts'

const FACTS: Facts = {
  beyond  : '',
  clear   : '5,000',
  factor  : '0.62',
  phase   : 'Daylight',
  reading : '3,100',
  sun     : '+21°',
  time    : '9:00 AM'
}

let root: HTMLElement

beforeEach(() => {
  root           = document.createElement('div')
  root.innerHTML = '<b data-fact="time"></b><i data-fact="reading"></i><s data-fact="factor"></s>'
    + '<u data-fact="factor"></u>'
})

it('writes each figure into every element naming it', () => {
  new Readout(root).write(FACTS)

  expect([...root.children].map(({ textContent }) => textContent))
    .toEqual(['9:00 AM', '3,100', '0.62', '0.62'])
  expect(root.hasAttribute('data-assumed')).toBe(false)
})

it('marks the root and shows a factor of 1 where no forecast step covers the minute', () => {
  const readout = new Readout(root)

  readout.write({ ...FACTS, factor: null })
  expect(root.hasAttribute('data-assumed')).toBe(true)
  expect(root.querySelector('s')!.textContent).toBe('1')

  readout.write(FACTS)
  expect(root.hasAttribute('data-assumed')).toBe(false)
})
