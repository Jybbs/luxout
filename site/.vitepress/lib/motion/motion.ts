import { StorageSerializers, useLocalStorage, usePreferredReducedMotion } from '@vueuse/core'
import { type ComputedRef, computed, watchEffect }                        from 'vue'

const KEY = 'luxout-paused'

/**
 * The one paused state every drawing on the site reads, and the switch that
 * sets it.
 */
interface Motion {
  /**
   * Whether every drawing holds where it stands, which is the reader's own
   * choice once they have made one and their preference for reduced motion
   * until then.
   */
  readonly paused: ComputedRef<boolean>
  /**
   * Sets the reader's choice to `paused`, which the site keeps across pages and
   * visits.
   */
  readonly set: (paused: boolean) => void
}

/**
 * Reads the site's one paused state, the reader's choice kept in local storage
 * under `luxout-paused` beside their preference for reduced motion, where the
 * storage event a write sends brings every caller's copy to the same choice.
 */
export function useMotion(): Motion {
  const reduced = usePreferredReducedMotion()
  const chosen  = useLocalStorage<boolean | null>(KEY, null, { serializer: StorageSerializers.boolean })

  return {
    paused : computed(() => chosen.value ?? reduced.value === 'reduce'),
    set    : (paused) => { chosen.value = paused }
  }
}

/**
 * Marks the root element `data-paused` while the site's drawings hold, which
 * stops every animation the stylesheets run.
 */
export function writePaused(root: HTMLElement): void {
  const { paused } = useMotion()

  watchEffect(() => root.toggleAttribute('data-paused', paused.value))
}
