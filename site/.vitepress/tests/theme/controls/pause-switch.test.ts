/** @vitest-environment happy-dom */
import { fireEvent, getByRole, getByText } from '@testing-library/dom'
import { expect, vi }                     from 'vitest'
import { createSSRApp, h, nextTick }      from 'vue'
import { renderToString }                 from 'vue/server-renderer'

import { PauseSwitch } from '../../../theme/controls/pause-switch.tsx'
import { stubMedia }   from '../../common/media.ts'
import { test }        from '../../common/mount.ts'

const HELD    = { checked: 'false', title: 'Play the moving drawings' }
const PLAYING = { checked: 'true', title: 'Pause the moving drawings' }

/**
 * Reads the state the switch shows, its `aria-checked` and the hint its title
 * gives.
 */
function shown(control: HTMLElement): { checked: string | null, title: string | null } {
  return { checked: control.getAttribute('aria-checked'), title: control.getAttribute('title') }
}

test('reads as a switch named for the drawings, on while they play', ({ mount }) => {
  stubMedia(() => false)

  const control = getByRole(mount(PauseSwitch), 'switch', { name: 'Moving drawings' })

  expect(control.localName).toBe('button')
  expect(shown(control)).toEqual(PLAYING)
})

test('shows a swell in its thumb while on and a level line while off', ({ mount }) => {
  stubMedia(() => false)

  const [swell, level] = mount(PauseSwitch).querySelectorAll('path')

  expect(swell!.classList.contains('group-aria-checked:opacity-100')).toBe(true)
  expect(level!.classList.contains('group-aria-checked:opacity-0')).toBe(true)
})

test('animates its thumb and glyphs only from the second frame after it mounts', async ({ mount }) => {
  stubMedia(() => false)

  const thumb          = getByRole(mount(PauseSwitch), 'switch').firstElementChild!
  const [swell, level] = thumb.querySelectorAll('path')
  const moving         = (): boolean[] => [
    thumb.classList.contains('motion-safe:transition-[translate,color]'),
    swell!.classList.contains('motion-safe:transition-opacity'),
    level!.classList.contains('motion-safe:transition-opacity')
  ]

  vi.advanceTimersToNextFrame()
  await nextTick()
  expect(moving()).toEqual([false, false, false])

  vi.advanceTimersToNextFrame()
  await nextTick()
  expect(moving()).toEqual([true, true, true])
})

test('turns off once mounted for a reader who prefers reduced motion', async ({ mount }) => {
  stubMedia(() => true)

  const control = getByRole(mount(PauseSwitch), 'switch')

  await nextTick()
  expect(shown(control)).toEqual(HELD)
})

test('flips the paused state on each press and keeps the choice', async ({ mount }) => {
  stubMedia(() => false)

  const control = getByRole(mount(PauseSwitch), 'switch')

  fireEvent.click(control)
  await nextTick()
  expect(shown(control)).toEqual(HELD)
  expect(localStorage.getItem('luxout-paused')).toBe('true')

  fireEvent.click(control)
  await nextTick()
  expect(shown(control)).toEqual(PLAYING)
  expect(localStorage.getItem('luxout-paused')).toBe('false')
})

test('labels its row in the small-screen menu with the name it carries', ({ mount }) => {
  stubMedia(() => false)

  const host = mount(PauseSwitch, { row: true })

  expect(getByText(host, 'Moving drawings').localName).toBe('p')
  expect(shown(getByRole(host, 'switch', { name: 'Moving drawings' }))).toEqual(PLAYING)
})

test('hydrates its playing server render to the stored choice', async ({ onTestFinished }) => {
  stubMedia(() => false)
  localStorage.setItem('luxout-paused', 'true')
  onTestFinished(() => localStorage.clear())

  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const host = document.createElement('div')

  host.innerHTML = await renderToString(h(PauseSwitch))
  expect(shown(getByRole(host, 'switch'))).toEqual(PLAYING)

  document.body.append(host)
  const app = createSSRApp(PauseSwitch)

  app.mount(host)
  onTestFinished(() => {
    app.unmount()
    host.remove()
  })
  await nextTick()

  expect(warn.mock.calls.flat().filter((line) => String(line).includes('Hydration'))).toEqual([])
  expect(shown(getByRole(host, 'switch'))).toEqual(HELD)
})
