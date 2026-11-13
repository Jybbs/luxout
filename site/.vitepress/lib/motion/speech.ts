import { type LiveRegion, createLiveRegion }           from '@zag-js/live-region'
import { type ShallowRef, onBeforeUnmount, onMounted } from 'vue'

import { PAUSES } from './timing.ts'

/**
 * Speaks a widget's words through a polite live region inside the widget's
 * root, which is created once the widget mounts and removed once it unmounts.
 * Each message waits out the speech pause and replaces one still pending, so a
 * run of changes speaks only the last.
 */
export class Speech {
  #region: LiveRegion | undefined

  constructor(root: Readonly<ShallowRef<HTMLElement | undefined>>) {
    onMounted(() => {
      this.#region = createLiveRegion({ delay: PAUSES.speech, root: root.value! })
    })
    onBeforeUnmount(() => {
      this.#region?.destroy()
      this.#region = undefined
    })
  }

  say(words: string): void {
    this.#region?.announce(words)
  }
}
