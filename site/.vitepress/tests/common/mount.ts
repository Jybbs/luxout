import { test as base, vi }                       from 'vitest'
import { type App, type Component, createApp, h } from 'vue'

/**
 * Stops the clock and the animation frame together and mounts a component into
 * the document, unmounting each one once the case ends or once it calls
 * `unmount`.
 */
export const test = base.extend('apps', (): App[] => [])
  .extend('unmount', ({ apps }) => () => {
    apps.splice(0).forEach((app) => app.unmount())
  })
  .extend('mount', ({ apps, unmount }, { onCleanup }) => {
    // Builds Vue's renderer on the real clock, since its first build starts a three-second devtools timer.
    createApp({})
    vi.useFakeTimers()
    onCleanup(() => {
      unmount()
      document.body.replaceChildren()
      vi.useRealTimers()
    })

    return (
      component : Component,
      props     : Record<string, unknown> = {},
      slot?     : (scope: never) => unknown
    ): HTMLElement => {
      const host = document.createElement('div')
      const app  = createApp({ render: () => h(component, props, slot && { default: slot }) })

      document.body.append(host)
      app.mount(host)
      apps.push(app)

      return host
    }
  })
