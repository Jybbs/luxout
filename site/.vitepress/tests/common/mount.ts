import { fireEvent }                                        from '@testing-library/dom'
import { test as base, vi }                                 from 'vitest'
import { type App, type Component, createApp, h, nextTick } from 'vue'

/**
 * A function mounting `component` with `props` and a default `slot` into a host
 * appended to the document and returning the host.
 */
export type Mount = (
  component : Component,
  props?    : Record<string, unknown>,
  slot?     : (scope: never) => unknown
) => HTMLElement

/**
 * Stops the clock and the animation frame together and mounts a component into
 * the document, unmounting each one once the case ends or once it calls
 * `unmount`.
 */
export const test = base.extend('apps', (): App[] => [])
  .extend('unmount', ({ apps }) => () => {
    apps.splice(0).forEach((app) => app.unmount())
  })
  .extend('mount', ({ apps, unmount }, { onCleanup }): Mount => {
    // Builds Vue's renderer on the real clock, since its first build starts a three-second devtools timer.
    createApp({})
    vi.useFakeTimers()
    onCleanup(() => {
      unmount()
      document.body.replaceChildren()
      vi.useRealTimers()
    })

    return (component, props = {}, slot) => {
      const host = document.createElement('div')
      const app  = createApp({ render: () => h(component, props, slot && { default: slot }) })

      document.body.append(host)
      app.mount(host)
      apps.push(app)

      return host
    }
  })

/**
 * Focuses `slider` and presses `key` on it once the focus has landed, since the
 * slider machine moves its value on a key only while its thumb holds the focus.
 */
export async function keyOn(slider: HTMLElement, key: string): Promise<void> {
  slider.focus()
  await nextTick()
  fireEvent.keyDown(slider, { key })
}

/**
 * Waits out the microtask in which the slider machine sets the value under a
 * pointer, then the render that follows it.
 */
export async function pointed(): Promise<void> {
  await Promise.resolve()
  await nextTick()
}

/**
 * Lays out the control around the thumb `slider` as `rect`, moving the clock
 * past the render, since Vue drops an event no later than the moment its
 * listener attached.
 */
export function pressable(slider: HTMLElement, rect: Partial<DOMRect>): void {
  vi.spyOn(slider.parentElement!, 'getBoundingClientRect').mockReturnValue(rect as DOMRect)
  vi.advanceTimersByTime(1)
}
