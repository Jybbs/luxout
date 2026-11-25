/** @vitest-environment happy-dom */
import { fireEvent } from '@testing-library/dom'
import { expect, vi } from 'vitest'
import { nextTick }   from 'vue'

import { PAUSES }         from '../../../../../site/.vitepress/lib/motion/timing.ts'
import { WordsCaptioned } from '../../../../../site/.vitepress/theme/components/identity/words.tsx'
import { data }           from '../../../common/data/identity.ts'
import { test }           from '../../../common/mount.ts'

vi.mock(
  '../../../../../site/.vitepress/lib/identity/identity.data.ts',
  () => import('../../../common/data/identity.ts')
)

function lines(host: HTMLElement): HTMLElement[] {
  return [...host.querySelector('.words-captioned')!.children] as HTMLElement[]
}

function dimmed(host: HTMLElement): boolean[] {
  return lines(host).map(({ classList }) => classList.contains('opacity-55'))
}

test('captions each line with where it appears, and the tagline alone with its face', ({ mount }) => {
  const [tagline, byline] = data.lines

  expect(lines(mount(WordsCaptioned)).map(({ textContent }) => textContent)).toEqual([
    `${tagline!.text}Tagline · ${tagline!.face} · ${tagline!.where}`,
    `${byline!.text}Byline · ${byline!.where}`
  ])
})

test('dims the other line while the focus rests on one, lighting both once it leaves', async ({ mount }) => {
  const host = mount(WordsCaptioned)

  fireEvent.focus(lines(host)[1]!)
  await nextTick()
  expect(dimmed(host)).toEqual([true, false])

  fireEvent.blur(lines(host)[1]!)
  await nextTick()
  expect(dimmed(host)).toEqual([false, false])
})

test('lights a line once a mouse dwells on it, and both once it leaves', async ({ mount }) => {
  const host = mount(WordsCaptioned)

  fireEvent.pointerEnter(lines(host)[0]!, { pointerType: 'mouse' })
  vi.advanceTimersByTime(PAUSES.dwell - 1)
  await nextTick()
  expect(dimmed(host)).toEqual([false, false])

  vi.advanceTimersByTime(1)
  await nextTick()
  expect(dimmed(host)).toEqual([false, true])

  fireEvent.pointerLeave(host.querySelector('.words-captioned')!)
  vi.advanceTimersByTime(PAUSES.leave)
  await nextTick()
  expect(dimmed(host)).toEqual([false, false])
})

test('sets both lines in the base face, the tagline alone in its italic', ({ mount }) => {
  expect(lines(mount(WordsCaptioned)).map((line) =>
    [line.classList.contains('font-base'), line.querySelector('p')!.classList.contains('italic')]
  )).toEqual([[true, true], [true, false]])
})
