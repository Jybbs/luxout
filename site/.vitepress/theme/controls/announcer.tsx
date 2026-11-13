import { tryOnScopeDispose } from '@vueuse/core'
import { type PropType, type ShallowRef, type VNode, defineComponent, shallowRef } from 'vue'

import { PAUSES } from '../../lib/motion/timing.ts'

/**
 * Speaks a widget's words through a polite live region once the speech pause
 * has passed, so a run of changes speaks only the last.
 */
export class Announcer {
  readonly #live = shallowRef('')

  readonly #speak = (): void => {
    this.#live.value = this.#words
  }

  #timer : ReturnType<typeof setTimeout> | undefined
  #words = ''

  constructor() {
    tryOnScopeDispose(() => clearTimeout(this.#timer))
  }

  get region(): VNode {
    return <LiveRegion live={this.#live} />
  }

  say(words: string): void {
    clearTimeout(this.#timer)
    this.#words = words
    this.#timer = setTimeout(this.#speak, PAUSES.speech)
  }
}

/**
 * Renders the words on its own, so a change of words re-renders nothing around
 * the region.
 */
const LiveRegion = defineComponent({
  name  : 'LiveRegion',
  props : { live: { required: true, type: Object as PropType<ShallowRef<string>> } },
  setup(props) {
    return () => <p aria-live="polite" class="sr-only">{props.live.value}</p>
  }
})
