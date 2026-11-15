/** @vitest-environment happy-dom */
import { fireEvent, getAllByRole, getByRole } from '@testing-library/dom'
import { expect, vi }                        from 'vitest'
import { nextTick }                          from 'vue'

import { FacesBar }        from '../../../../theme/components/identity/faces.tsx'
import { data }            from '../../../common/data/identity.ts'
import { pressable, test } from '../../../common/mount.ts'

vi.mock('../../../../lib/identity/identity.data.ts', () => import('../../../common/data/identity.ts'))

const [base, , mono] = data.faces
const opsz           = base!.axes.opsz!

async function press(host: HTMLElement, key: string, shiftKey = false): Promise<string> {
  const puck = getByRole(host, 'slider')

  fireEvent.keyDown(puck, { key, shiftKey })
  await nextTick()

  return puck.getAttribute('aria-valuetext')!
}

test('names a tab for each face the theme loads, in its own family', ({ mount }) => {
  const host = mount(FacesBar)

  expect(getAllByRole(host, 'tab').map((tab) => [tab.getAttribute('aria-label'), tab.style.fontFamily]))
    .toEqual(data.faces.map(({ family }) => [family, expect.stringContaining(`${family} Variable`)]))
})

test('opens on the base face at its default setting, setting the tagline', ({ mount }) => {
  const host = mount(FacesBar)

  expect(getByRole(host, 'slider').getAttribute('aria-valuetext'))
    .toBe(`Weight ${base!.axes.wght!.default}, optical size ${base!.axes.opsz!.default}`)
  expect(getByRole(host, 'tabpanel').textContent).toContain(data.tagline)
})

test('sets the tagline in the picked face at the puck’s setting, under its readout', ({ mount }) => {
  const panel                = getByRole(mount(FacesBar), 'tabpanel')
  const proof                = panel.querySelector<HTMLElement>('span[style]')!
  const { opsz: size, wght } = base!.axes

  expect([proof.style.fontFamily, proof.style.fontVariationSettings]).toEqual([
    expect.stringContaining(`${base!.family} Variable`),
    `'wght' ${wght!.default}, 'opsz' ${size!.default}`
  ])
  expect(panel.textContent).toContain(`Weight ${wght!.default} · Opsz ${size!.default}`)
})

test.for([
  { key: 'End', want: `Weight ${base!.axes.wght!.max}` },
  { key: 'Home', want: `Weight ${base!.axes.wght!.min}` },
  { key: 'PageUp', want: `optical size ${Math.round(opsz.default + (opsz.max - opsz.min) * 0.1)}` },
  { key: 'PageDown', want: `optical size ${Math.round(opsz.default - (opsz.max - opsz.min) * 0.1)}` },
  { key: 'ArrowUp', want: `optical size ${Math.round(opsz.default + (opsz.max - opsz.min) * 0.02)}` },
  { key: 'ArrowDown', want: `optical size ${Math.round(opsz.default - (opsz.max - opsz.min) * 0.02)}` }
])('moves the puck on $key', async ({ key, want }, { mount }) => {
  expect(await press(mount(FacesBar), key)).toContain(want)
})

test('steps the weight a fiftieth of its span on an arrow and a tenth with Shift held', async ({ mount }) => {
  const host  = mount(FacesBar)
  const { max, min } = base!.axes.wght!
  const start = base!.axes.wght!.default

  expect(await press(host, 'ArrowRight')).toContain(`Weight ${Math.round(start + (max - min) * 0.02)}`)
  expect(await press(host, 'ArrowLeft', true)).toContain(`Weight ${Math.round(start + (max - min) * -0.08)}`)
})

test('ignores a key that moves nothing', async ({ mount }) => {
  const host = mount(FacesBar)
  const was  = getByRole(host, 'slider').getAttribute('aria-valuetext')

  expect(await press(host, 'a')).toBe(was)
})

test('keeps the puck in place on a switch to the mono face, reading weight alone', async ({ mount }) => {
  const host = mount(FacesBar)

  await press(host, 'End')
  fireEvent.click(getAllByRole(host, 'tab')[2]!)
  await nextTick()

  expect(getByRole(host, 'slider').getAttribute('aria-valuetext')).toBe(`Weight ${mono!.axes.wght!.max}`)
  expect(getByRole(host, 'slider').getAttribute('aria-label')).toBe(`${mono!.family}, weight`)
  expect(getByRole(host, 'tabpanel').textContent).toContain('No optical size')
})

test('sets the puck where a press lands, weight across and optical size up', async ({ mount }) => {
  const host = mount(FacesBar)
  const puck = getByRole(host, 'slider')
  const pad  = puck.parentElement!

  pressable(puck, { height: 100, left: 0, top: 0, width: 200 })
  pad.setPointerCapture = vi.fn<(pointerId: number) => void>()
  fireEvent.pointerDown(pad, { clientX: 200, clientY: 0, pointerId: 1 })
  await nextTick()

  expect(getByRole(host, 'slider').getAttribute('aria-valuetext'))
    .toBe(`Weight ${base!.axes.wght!.max}, optical size ${base!.axes.opsz!.max}`)
})

test.for(data.faces.map((face, index) => ({ ...face, index })))(
  'sets the $family tab and proof in capitals only where the face is the mono',
  async ({ index, role }, { mount }) => {
    const host = mount(FacesBar)
    const tab  = getAllByRole(host, 'tab')[index]!

    fireEvent.click(tab)
    await nextTick()

    const proof = getByRole(host, 'tabpanel').querySelector<HTMLElement>('span[style]')!

    expect([tab.firstElementChild!.classList.contains('uppercase'), proof.style.textTransform])
      .toEqual(role === 'mono' ? [true, 'uppercase'] : [false, 'none'])
  }
)
