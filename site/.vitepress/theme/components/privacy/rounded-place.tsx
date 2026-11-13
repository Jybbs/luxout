import { useTimeoutFn }                            from '@vueuse/core'
import { type VNode, defineComponent, shallowRef } from 'vue'

import { PAUSES }                               from '../../../lib/motion/timing.ts'
import { data }                                 from '../../../lib/privacy/privacy.data.ts'
import { type MarkKey, type PlaceMark, markAt } from '../../../lib/privacy/rounded-place.ts'
import { placeDrawing }                         from './place-drawing.tsx'

import './styles/rounded-place.css'

const { place } = data

const SWATCHES = {
  area  : () => [<rect class="rounded-place-area" height={10} width={14} x={4} y={1} />],
  cell  : () => [
    <rect class="rounded-place-cell" height={10} width={20} x={1} y={1} />,
    <path class="rounded-place-tile" d="M11 1V11" />
  ],
  pair  : () => [patch(), <circle class="rounded-place-dot" cx={11} cy={6} r={3.5} />],
  place : () => [patch(), <circle class="rounded-place-ring" cx={11} cy={6} r={5} />]
} satisfies Record<MarkKey, () => VNode[]>

/**
 * Holds the mark the key and the drawing bring forward together, showing a
 * mark a mouse rests on once the dwell pause passes and clearing it once the
 * leave pause passes after the mouse goes.
 */
class Key {
  readonly onPointerdown = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') this.show(this.#under(event))
  }

  readonly onPointerleave = ({ pointerType }: PointerEvent): void => {
    if (pointerType === 'mouse') this.rest(undefined)
  }

  readonly onPointermove = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') this.rest(this.#under(event))
  }

  readonly shown  = shallowRef<MarkKey>()
  readonly #dwell = useTimeoutFn((key: MarkKey) => this.show(key), PAUSES.dwell, { immediate: false })
  readonly #leave = useTimeoutFn(() => this.show(undefined), PAUSES.leave, { immediate: false })
  #wanted         : MarkKey | undefined

  renderPlot(): VNode {
    return (
      <div
        class="rounded-place-plot"
        onPointerdown={this.onPointerdown}
        onPointerleave={this.onPointerleave}
        onPointermove={this.onPointermove}
      >
        {placeDrawing(place)}
      </div>
    )
  }

  renderRow({ key: mark, name, value }: PlaceMark): VNode {
    return (
      <button
        class={['rounded-place-row', { on: this.shown.value === mark }]}
        onBlur={() => this.show(undefined)}
        onClick={() => this.show(mark)}
        onFocus={() => this.show(mark)}
        onKeydown={(event) => event.key === 'Escape' && this.show(undefined)}
        onPointerenter={() => this.rest(mark)}
        onPointerleave={({ currentTarget }) => {
          if (document.activeElement !== currentTarget) this.rest(undefined)
        }}
        type="button"
      >
        <svg aria-hidden class="rounded-place-swatch" viewBox="0 0 22 12">{...SWATCHES[mark]()}</svg>
        <span class="rounded-place-name widget-caps">{name}</span>
        <span class="rounded-place-value widget-num">{value}</span>
      </button>
    )
  }

  rest(key: MarkKey | undefined): void {
    if (key === this.#wanted) return

    this.#stop(key)

    if (key) this.#dwell.start(key)
    else this.#leave.start()
  }

  show(key: MarkKey | undefined): void {
    this.#stop(key)
    this.shown.value = key
  }

  #stop(key: MarkKey | undefined): void {
    this.#dwell.stop()
    this.#leave.stop()
    this.#wanted = key
  }

  /**
   * Finds the mark under the pointer of `event`, in the units of the drawing
   * the element it reaches holds.
   */
  #under({ clientX, clientY, currentTarget }: PointerEvent): MarkKey | undefined {
    const { height, left, top, width } = (currentTarget as HTMLElement).getBoundingClientRect()

    return markAt(place, [(clientX - left) / width * place.width, (clientY - top) / height * place.height])
  }
}

/**
 * Draws the cell a request's rounded place falls in beside a key of its marks,
 * each row a swatch, a name, and the mark's figure, the row and its mark
 * coming forward together while a pointer rests on either, while the row
 * holds focus, or once either is tapped.
 */
export const RoundedPlace = defineComponent({
  name: 'RoundedPlace',
  setup() {
    const key = new Key()

    return () => (
      <div class="widget rounded-place" data-shown={key.shown.value}>
        <div class="rounded-place-body">
          {key.renderPlot()}
          <ul aria-label="Key to the drawing" class="rounded-place-rows">
            {...place.marks.map((mark) => <li>{key.renderRow(mark)}</li>)}
          </ul>
        </div>
      </div>
    )
  }
})

function patch(): VNode {
  return <rect class="rounded-place-patch" height={12} rx={2} width={16} x={3} />
}
