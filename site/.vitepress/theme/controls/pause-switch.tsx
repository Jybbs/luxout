import { defineComponent } from 'vue'

import { useMotion } from '../../lib/motion/motion.ts'

/**
 * Pauses every drawing on the site where it stands, as a button taking the
 * ARIA switch pattern, checked while the drawings are paused, which Space and
 * Enter flip as they press any button.
 */
export const PauseSwitch = defineComponent({
  name: 'PauseSwitch',
  setup() {
    const { paused, set } = useMotion()

    return () => (
      <button aria-checked={paused.value} role="switch" type="button" onClick={() => set(!paused.value)}>
        Pause drawings
      </button>
    )
  }
})
