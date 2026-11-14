import { useMounted }                                         from '@vueuse/core'
import { type VNode, defineComponent, onMounted, shallowRef } from 'vue'

import { useMotion } from '../../lib/motion/motion.ts'

/**
 * The utilities the switch's track, its thumb, and each glyph the thumb draws
 * take, the thumb standing at the track's far end in the link color while the
 * switch is on and each glyph fading out while the other shows, and the
 * transitions that slide the thumb and fade each glyph.
 */
const CLASSES = {
  fade  : 'motion-safe:transition-opacity motion-safe:duration-(--timing-move)',
  slide : 'motion-safe:transition-[translate,color] motion-safe:duration-(--timing-move)',

  thumb: [
    'absolute top-px left-px grid size-4.5 place-items-center rounded-full bg-(--vp-c-neutral-inverse)',
    'text-muted shadow-(--vp-shadow-1) dark:text-ink group-aria-checked:translate-x-4.5',
    'group-aria-checked:text-accent'
  ],

  track: [
    'group relative block h-5.5 w-10 flex-none rounded-full border',
    'border-(--vp-input-border-color) bg-(--vp-input-switch-bg-color) hover:border-accent',
    'motion-safe:transition-colors motion-safe:duration-(--timing-hover)'
  ]
}
const NAME = 'Moving drawings'

/**
 * Plays the site's drawings or holds them where they stand.
 */
class Drawings {
  readonly press = (): void => {
    this.#motion.set(this.playing)
  }

  readonly #motion  = useMotion()
  readonly #mounted = useMounted()
  readonly #moving  = shallowRef(false)

  /**
   * Lets the thumb slide and its glyphs fade only from the second frame after
   * the page mounts, so the switch takes a stored pause without moving.
   */
  constructor() {
    onMounted(() => requestAnimationFrame(() => requestAnimationFrame(() => { this.#moving.value = true })))
  }

  /**
   * Whether the drawings play, read as playing until the page mounts and from
   * the site's one paused state after it.
   */
  get playing(): boolean {
    return !(this.#mounted.value && this.#motion.paused.value)
  }

  /**
   * Draws the switch, its thumb drawing a swell while the drawings play and a
   * level line while they hold.
   */
  switch(): VNode {
    const moving  = this.#moving.value
    const playing = this.playing

    return (
      <button
        aria-checked={playing}
        aria-label={NAME}
        class={CLASSES.track}
        role="switch"
        title={playing ? 'Pause the moving drawings' : 'Play the moving drawings'}
        type="button"
        onClick={this.press}
      >
        <span class={[CLASSES.thumb, moving && CLASSES.slide]}>
          <svg
            aria-hidden
            class="size-3 fill-none stroke-current"
            stroke-linecap="round"
            stroke-width="1.6"
            viewBox="0 0 12 12"
          >
            <path
              class={['opacity-0 group-aria-checked:opacity-100', moving && CLASSES.fade]}
              d="M1.4 6.8Q3 3.6 4.6 6.2T7.8 6.2T10.6 5.4"
            />
            <path class={['group-aria-checked:opacity-0', moving && CLASSES.fade]} d="M1.6 6H10.4" />
          </svg>
        </span>
      </button>
    )
  }
}

/**
 * Plays every drawing on the site or holds each where it stands, through a
 * button taking the ARIA switch pattern that is on while the drawings play.
 *
 * The button is named for the drawings, and its title says what a press does.
 * It takes the measures of the default theme's appearance switch so the two
 * read as a pair, standing in the bar from the medium breakpoint and, under
 * `row`, as a labeled row in the small-screen menu, as that switch does. It
 * keeps its place in the bar where that switch moves into the More options
 * menu, since the theme's overflow handling counts it as a fixed width.
 */
export const PauseSwitch = defineComponent({
  name  : 'PauseSwitch',
  props : { row: Boolean },
  setup(props) {
    const drawings = new Drawings()

    return () => props.row
      ? (
        <div class="mt-4 flex items-center justify-between rounded-lg bg-(--vp-c-bg-soft) py-3 pr-3.5 pl-4">
          <p class="text-[0.75rem]/[2] font-medium text-muted">{NAME}</p>
          {drawings.switch()}
        </div>
      )
      : <div class="hidden items-center pl-4 md:flex">{drawings.switch()}</div>
  }
})
