import { type VNode, defineComponent, shallowRef } from 'vue'

import { data }                                 from '../../../lib/privacy/privacy.data.ts'
import { type MarkKey, type PlaceMark, markAt } from '../../../lib/privacy/rounded-place.ts'
import { Pauses }                               from '../../controls/pauses.ts'
import { placeDrawing }                         from './place-drawing.tsx'

/**
 * The utilities the widget draws each mark of the drawing and of the key in,
 * by the class the mark carries.
 */
const MARKS = [
  '[&_.rounded-place-cell]:fill-place-cell [&_.rounded-place-cell]:stroke-forecast',
  '[&_.rounded-place-cell]:stroke-[1.5]',
  '[&_.rounded-place-tile]:fill-none [&_.rounded-place-tile]:stroke-forecast',
  '[&_.rounded-place-tile]:stroke-1',
  '[&_:is(.rounded-place-area,.rounded-place-patch)]:fill-place-area',
  '[&_.rounded-place-area]:stroke-ink [&_.rounded-place-area]:stroke-[1.2]',
  '[&_.rounded-place-ring]:fill-none [&_.rounded-place-ring]:stroke-ink',
  '[&_.rounded-place-ring]:stroke-[1.5] [&_.rounded-place-dot]:fill-ink',
  '[&_.rounded-place-dim]:fill-none [&_.rounded-place-dim]:stroke-muted',
  '[&_.rounded-place-dim]:stroke-1 [&_.rounded-place-word]:fill-muted [&_.rounded-place-word]:text-[11px]',
  'dark:[&_:is(.rounded-place-area,.rounded-place-patch)]:fill-area dark:[&_.rounded-place-dot]:fill-ground',
  'dark:[&_:is(.rounded-place-area,.rounded-place-ring)]:stroke-ground'
]
/**
 * The utilities the plot takes, its drawing bringing forward the mark the
 * widget shows.
 */
const PLOT = [
  'rounded-place-plot w-full max-w-[402px] *:widget-num *:block *:h-auto *:w-full *:overflow-visible',
  '[&_svg_*]:transition-[stroke-width,r,stroke] [&_svg_*]:duration-(--timing-hover)',
  'group-data-[shown=area]:[&_.rounded-place-area]:stroke-3',
  'group-data-[shown=cell]:[&_.rounded-place-cell]:stroke-3',
  'group-data-[shown=cell]:[&_.rounded-place-tile]:stroke-2',
  'group-data-[shown=cell]:[&_.rounded-place-dim]:stroke-ink',
  'group-data-[shown=cell]:[&_.rounded-place-dim]:stroke-[1.5]',
  'group-data-[shown=cell]:[&_.rounded-place-word]:fill-ink',
  'group-data-[shown=cell]:[&_.rounded-place-word]:font-semibold',
  'group-data-[shown=pair]:[&_.rounded-place-dot]:[r:5px]',
  'group-data-[shown=place]:[&_.rounded-place-ring]:stroke-3'
]

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
  readonly shown = shallowRef<MarkKey>()

  readonly #onPointerdown = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') this.show(this.#under(event))
  }

  readonly #onPointerleave = ({ pointerType }: PointerEvent): void => {
    if (pointerType === 'mouse') this.rest(undefined)
  }

  readonly #onPointermove = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') this.rest(this.#under(event))
  }

  readonly #pauses = new Pauses((key: MarkKey) => this.show(key), () => this.show(undefined))
  #wanted          : MarkKey | undefined

  renderPlot(): VNode {
    return (
      <div
        class={PLOT}
        onPointerdown={this.#onPointerdown}
        onPointerleave={this.#onPointerleave}
        onPointermove={this.#onPointermove}
      >
        {placeDrawing(place)}
      </div>
    )
  }

  renderRow({ key: mark, name, value }: PlaceMark): VNode {
    return (
      <button
        class={[
          'grid w-full cursor-default grid-cols-[22px_minmax(0,1fr)] items-center gap-x-3 gap-y-0.75',
          'rounded-md border px-2.5 py-1.75 text-left text-ink transition-colors duration-(--timing-hover)',
          this.shown.value === mark ? 'on border-ink bg-raised' : 'border-transparent bg-transparent'
        ]}
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
        <svg aria-hidden class="row-span-2 h-3 w-5.5" viewBox="0 0 22 12">{...SWATCHES[mark]()}</svg>
        <span class="font-mono text-[0.62rem]/[1.15] font-medium tracking-[0.08em] text-muted uppercase">
          {name}
        </span>
        <span class="widget-num text-[0.86rem]/[1.3] whitespace-nowrap">{value}</span>
      </button>
    )
  }

  rest(key: MarkKey | undefined): void {
    if (key === this.#wanted) return

    this.#stop(key)

    if (key) this.#pauses.dwell.start(key)
    else this.#pauses.leave.start()
  }

  show(key: MarkKey | undefined): void {
    this.#stop(key)
    this.shown.value = key
  }

  #stop(key: MarkKey | undefined): void {
    this.#pauses.stop()
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
      <div class={['widget rounded-place group', ...MARKS]} data-shown={key.shown.value}>
        <div class="grid items-start gap-4 @lg:grid-cols-[minmax(0,402px)_minmax(0,1fr)] @lg:gap-6">
          {key.renderPlot()}
          <ul
            aria-label="Key to the drawing"
            class="m-0 grid list-none gap-0.5 p-0 *:m-0 @lg:justify-self-start"
          >
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
