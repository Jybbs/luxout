/** @vitest-environment happy-dom */
import { getByRole }                         from '@testing-library/dom'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { h, nextTick, ref }                  from 'vue'

import { positionOf }     from '../../../../lib/front/facts.ts'
import { useFrontMinute } from '../../../../lib/front/minute.ts'
import { useMotion }      from '../../../../lib/motion/motion.ts'
import { FrontHero }      from '../../../../theme/components/front/front-hero.tsx'
import { data }           from '../../../common/data/front.ts'
import { stubMedia }      from '../../../common/media.ts'
import { test }           from '../../../common/mount.ts'

vi.mock('../../../../lib/front/front.data.ts', () => import('../../../common/data/front.ts'))
vi.mock('vitepress', () => ({
  useData: () => ({ frontmatter: ref({ hero: { name: 'Luxout', tagline: 'How bright it is outside' } }) })
}))

const { day, hero } = data
const floor         = day.noon + hero.logs.length - 1
const Home          = () => h('div', { class: 'VPHome' }, [
  h('div', { class: 'VPHero' }, [h(FrontHero)]),
  h('div', { class: 'band' })
])

function scroll(to: number): void {
  vi.stubGlobal('scrollY', to)
  dispatchEvent(new Event('scroll'))
}

beforeEach(() => {
  stubMedia(() => false)
})

afterEach(() => {
  useFrontMinute().value = day.noon
})

test('names the site in the hero’s heading under its drawn title', ({ mount }) => {
  expect(getByRole(mount(Home), 'heading', { level: 1 }).textContent).toBe('Luxout')
})

test('colors the sky in each scheme by the reading at noon before any scroll', ({ mount }) => {
  const home = mount(Home).querySelector<HTMLElement>('.VPHome')!
  const step = Math.round(positionOf(day, day.readings[day.noon]!) * 255)

  expect(home.style.getPropertyValue('--front-sky-light')).toBe(hero.schemes.light.skies[step])
  expect(home.style.getPropertyValue('--front-sky-dark')).toBe(hero.schemes.dark.skies[step])
})

test('carries the shared minute from noon to HomeKit’s floor as the page scrolls', async ({ mount }) => {
  mount(Home)

  scroll(1)
  await nextTick()
  expect(useFrontMinute().value).toBeGreaterThan(day.noon)
  expect(useFrontMinute().value).toBeLessThan(floor)

  scroll(1e4)
  await nextTick()
  expect(useFrontMinute().value).toBe(floor)
})

test('holds the hero at noon while the site’s drawings are paused', async ({ mount }) => {
  mount(Home)
  scroll(1e4)
  await nextTick()

  useMotion().set(true)
  await nextTick()
  await nextTick()

  expect(useFrontMinute().value).toBe(day.noon)
})
