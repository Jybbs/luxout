import { clamp }                                     from '@vueuse/core'
import { type ShallowRef, type VNode, defineComponent, shallowRef, useId } from 'vue'

import { data }              from '../../../lib/identity/identity.data.ts'
import { Tablist, tabPanel } from '../../controls/tablist.tsx'

type Axis = Face['axes'][string]
type Face = (typeof data.faces)[number]

/**
 * A point on the pad, each coordinate a share of its side, `x` running right
 * and `y` running up.
 */
interface Point {
  x : number
  y : number
}

/**
 * A setting of a face's axes, the optical size left out for a face without
 * that axis.
 */
interface Setting {
  opsz? : number
  wght  : number
}

const FACES = data.faces
/**
 * The step an arrow key moves the puck, and the step it moves with Shift held,
 * as shares of the pad's side.
 */
const STEP = { fine: 0.02, page: 0.1 } as const

/**
 * The pad, weight across and optical size up, whose puck a press or a drag
 * sets directly and the arrow keys move, Shift taking a longer step. The puck
 * keeps its point whichever face a reader switches to, so a drag carries on
 * across a switch.
 */
class Pad {
  readonly at : ShallowRef<Point>

  readonly #onKeydown = (event: KeyboardEvent): void => {
    const step  = event.shiftKey ? STEP.page : STEP.fine
    const moves = {
      ArrowDown  : { y: -step },
      ArrowLeft  : { x: -step },
      ArrowRight : { x: step },
      ArrowUp    : { y: step },
      End        : { x: 1 },
      Home       : { x: -1 },
      PageDown   : { y: -STEP.page },
      PageUp     : { y: STEP.page }
    } as Record<string, Partial<Point>>
    const move  = moves[event.key]

    if (!move) return

    event.preventDefault()
    this.move((move.x ?? 0) + this.at.value.x, (move.y ?? 0) + this.at.value.y)
  }

  readonly #onPointerdown = (event: PointerEvent): void => {
    const pad = event.currentTarget as HTMLElement

    pad.setPointerCapture(event.pointerId)
    pad.querySelector<HTMLElement>('[role="slider"]')?.focus({ preventScroll: true })
    this.#follow(event)
  }

  readonly #onPointermove = (event: PointerEvent): void => {
    if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) this.#follow(event)
  }

  constructor(start: Point) {
    this.at = shallowRef(start)
  }

  move(x: number, y: number): void {
    this.at.value = { x: clamp(x, 0, 1), y: clamp(y, 0, 1) }
  }

  /**
   * Draws the pad, the puck over it named `label` and speaking `spoken`, its
   * vertical travel dimmed where `flat` holds.
   */
  render(label: string, spoken: string, flat: boolean): VNode {
    const { x, y } = this.at.value

    return (
      <div
        class="relative h-40 cursor-crosshair touch-none rounded-md bg-raised ring-1 ring-rule select-none"
        onPointerdown={this.#onPointerdown}
        onPointermove={this.#onPointermove}
      >
        <svg
          aria-hidden
          class="pointer-events-none absolute inset-0 size-full text-muted opacity-40"
          fill="none"
          preserveAspectRatio="none"
          stroke="currentColor"
          viewBox="0 0 100 100"
        >
          <path
            d={`M${x * 100} 0V100`}
            stroke-dasharray={flat ? '2 2' : undefined}
            vector-effect="non-scaling-stroke"
          />
          {!flat && <path d={`M0 ${(1 - y) * 100}H100`} vector-effect="non-scaling-stroke" />}
        </svg>
        <div
          aria-label={label}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(x * 100)}
          aria-valuetext={spoken}
          class={[
            'absolute size-4.5 -translate-1/2 rounded-full bg-raised',
            'shadow-[0_0_0_1.5px_var(--color-ink),0_2px_6px_-2px_var(--color-shadow)]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
          ]}
          onKeydown={this.#onKeydown}
          role="slider"
          style={{ left: `${x * 100}%`, top: `${(1 - (flat ? 0.5 : y)) * 100}%` }}
          tabindex={0}
        />
      </div>
    )
  }

  #follow({ clientX, clientY, currentTarget }: PointerEvent): void {
    const { height, left, top, width } = (currentTarget as HTMLElement).getBoundingClientRect()

    this.move((clientX - left) / width, 1 - (clientY - top) / height)
  }
}

/**
 * One pad under a segmented bar naming each face, the tagline set in the
 * face picked at the puck's point across that face's own spans, so a switch
 * keeps the puck where it stands and resets nothing.
 */
export const FacesBar = defineComponent({
  name: 'FacesBar',
  setup() {
    const id     = useId()
    const picked = shallowRef(0)
    const pad    = new Pad(restOf(FACES[0]!))

    return () => {
      const face    = FACES[picked.value]!
      const setting = spanned(face, pad.at.value)
      const flat    = !face.axes.opsz

      return (
        <div class="widget faces-bar grid gap-2.5">
          <Tablist
            classes={{
              list : 'grid auto-cols-fr grid-flow-col gap-0.5 rounded-full p-0.5 ring-1 ring-rule',
              tab  : [
                'cursor-pointer rounded-full border-0 bg-transparent px-1 py-1.5 text-[0.7rem]/[1.2]',
                'whitespace-nowrap text-ink @sm:px-2 @sm:text-[0.8rem]/[1.2]',
                'transition-colors duration-(--timing-hover) data-selected:bg-ink data-selected:text-ground'
              ]
            }}
            id={id}
            label="Faces"
            onSelect={(index: number) => { picked.value = index }}
            selected={picked.value}
            tabs={FACES.map((each) => ({ label: each.family, style: { fontFamily: familyOf(each) } }))}
          >
            {{
              default: ({ index }: { index: number }) => [
                <span class={capitals(FACES[index]!) ? 'uppercase' : ''}>{FACES[index]!.family}</span>
              ]
            }}
          </Tablist>
          <div {...tabPanel(id, picked.value)} class="grid min-w-0 gap-3">
            {proof(face, setting)}
            {pad.render(
              flat ? `${face.family}, weight` : `${face.family}, weight and optical size`,
              settingText(setting),
              flat
            )}
            {scale(axisCaption(face, 'wght'), axisCaption(face, 'opsz'))}
          </div>
        </div>
      )
    }
  }
})

/**
 * Captions one axis of the pad in capitals: its name and its span in `face`.
 */
function axisCaption(face: Face, tag: 'opsz' | 'wght'): string {
  const axis = face.axes[tag]

  if (!axis) return 'No optical size'

  return `${tag === 'wght' ? 'Weight' : 'Optical size'} ${axis.min}–${axis.max}`
}

/**
 * Whether a face sets its words in JetBrains Mono's capitals, which every mono
 * line in a visual takes.
 */
function capitals(face: Face): boolean {
  return face.role === 'mono'
}

/**
 * The family the theme loads a face's package under.
 */
function familyOf(face: Face): string {
  return `'${face.family} Variable'`
}

/**
 * The tagline set in `face` at `setting` on a strip of its own above the pad,
 * under the setting's readout and tall enough for the widest setting to wrap
 * without moving the pad, so the puck never travels over the words it sets.
 */
function proof(face: Face, setting: Setting): VNode {
  return (
    <div
      class={[
        'grid min-h-28 grid-rows-[auto_1fr] gap-1 rounded-md bg-raised px-3 pt-2 pb-3 ring-1',
        'ring-rule'
      ]}
    >
      <span
        class={[
          'widget-num justify-self-end font-mono text-[0.6rem]/none font-medium tracking-[0.08em]',
          'text-ink uppercase'
        ]}
      >
        {setting.opsz === undefined
          ? `Weight ${Math.round(setting.wght)}`
          : `Weight ${Math.round(setting.wght)} · Opsz ${Math.round(setting.opsz)}`}
      </span>
      <div class="grid place-items-center text-center">
        {sample(face, setting, data.tagline, 'clamp(1.15rem, 5cqi, 1.9rem)')}
      </div>
    </div>
  )
}

/**
 * The point a face's default setting stands at across its own spans.
 */
function restOf(face: Face): Point {
  const { opsz, wght } = face.axes
  const share          = (axis: Axis) => (axis.default - axis.min) / (axis.max - axis.min)

  return { x: share(wght!), y: opsz ? share(opsz) : 0.5 }
}

/**
 * Sets `text` in `face` at `setting`, through the variation settings of both
 * axes so the optical size holds whatever size the text is set at.
 */
function sample(face: Face, setting: Setting, text: string, size: string): VNode {
  const axes = Object.entries(setting).map(([tag, value]) => `'${tag}' ${Math.round(value)}`).join(', ')

  return (
    <span
      class="block min-w-0 text-ink"
      style={{
        fontFamily            : familyOf(face),
        fontSize              : size,
        fontVariationSettings : axes,
        lineHeight            : '1.2',
        textTransform         : capitals(face) ? 'uppercase' : 'none'
      }}
    >
      {text}
    </span>
  )
}

/**
 * Names the pad's two axes on a line beneath it, weight across at the left and
 * optical size up at the right, so no caption lies where the puck travels.
 */
function scale(across: string, up: string): VNode {
  return (
    <div
      class={[
        'flex flex-wrap justify-between gap-x-3 gap-y-1 pt-1.5 font-mono text-[0.6rem]/none font-medium',
        'tracking-[0.08em] text-muted uppercase'
      ]}
    >
      <span>{across} →</span>
      <span>↑ {up}</span>
    </div>
  )
}

/**
 * Writes a setting as the readout and the slider's spoken value show it.
 */
function settingText({ opsz, wght }: Setting): string {
  return opsz === undefined
    ? `Weight ${Math.round(wght)}`
    : `Weight ${Math.round(wght)}, optical size ${Math.round(opsz)}`
}

/**
 * Reads the setting at `point` across each axis's own span in `face`.
 */
function spanned(face: Face, { x, y }: Point): Setting {
  const { opsz, wght } = face.axes
  const along          = (axis: Axis, share: number) => axis.min + (axis.max - axis.min) * share

  return { wght: along(wght!, x), ...opsz && { opsz: along(opsz, y) } }
}
