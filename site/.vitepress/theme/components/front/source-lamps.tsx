import * as radio                                 from '@zag-js/radio-group'
import { mergeProps, normalizeProps, useMachine } from '@zag-js/vue'
import { type VNode, computed, defineComponent, shallowRef, useId } from 'vue'

import { SOURCES, type Source } from '../../../lib/config/sources.ts'
import { Speech }               from '../../../lib/motion/speech.ts'
import { layers }               from '../../controls/layers.tsx'
import { Pauses }               from '../../controls/pauses.ts'

const INK = 'fill-none stroke-ink stroke-1'

/**
 * Draws each source's mark on a 44 by 30 grid, the line it stands on in ink.
 */
const MARKS = {
  arc: () => [
    <path class={INK} d="M2 24H42" />,
    <path
      class="fill-none stroke-geometry stroke-2"
      d="M6 24C12 2 32 2 38 24"
      stroke-dasharray="0.1 4"
      stroke-linecap="round"
    />,
    <circle class="fill-sky stroke-sky-edge stroke-[1.5]" cx="29" cy="8.6" r="3.2" />
  ],

  bars: () => [
    <path class={INK} d="M2 28H42" />,
    ...[[5, 18], [13, 12], [21, 6], [29, 10], [37, 4]].map(([x, y]) => (
      <rect class="fill-forecast" height={28 - y!} width="5" x={x} y={y} />
    ))
  ],

  bell: () => [
    <path class="fill-area" d="M2 28C12 28 14 4 22 4S32 28 42 28Z" />,
    <path class={INK} d="M2 28C12 28 14 4 22 4S32 28 42 28" />
  ],

  curve: () => [
    <path class="fill-sky-fill" d="M2 28C14 28 16 26 21 18S30 4 42 3V28Z" />,
    <path
      class="fill-none stroke-sky-edge stroke-[1.4] [stroke-linejoin:round]"
      d="M2 28C14 28 16 26 21 18S30 4 42 3"
    />
  ],

  pin: () => [
    <path class={INK} d="M22 28C22 28 12 17.5 12 11A10 10 0 0 1 32 11C32 17.5 22 28 22 28Z" />,
    <circle class={INK} cx="22" cy="11" r="3.4" />
  ]
} satisfies Record<Source['mark'], () => VNode[]>

/**
 * Sets the sources the reading rests on as round lamps in a row, a radio group
 * on Zag's machine that a press, the arrow keys, or a mouse resting through the
 * dwell pause moves, the lit lamp's glow breathing while a pointer rests on the
 * row and its credit set out beneath.
 */
export const SourceLamps = defineComponent({
  name: 'SourceLamps',
  setup() {
    const id      = useId()
    const root    = shallowRef<HTMLElement>()
    const chosen  = shallowRef(SOURCES[0]!.name)
    const speech  = new Speech(root)
    const service = useMachine(radio.machine, computed(() => ({
      id            : id,
      name          : 'source',
      onValueChange : ({ value }: radio.ValueChangeDetails) => choose(value!),
      orientation   : 'horizontal' as const,
      value         : chosen.value
    })))
    const api    = computed(() => radio.connect(service, normalizeProps))
    const pauses = new Pauses((name: string) => api.value.setValue(name))
    const choose = (name: string) => {
      const { says, terms } = SOURCES.find((source) => source.name === name)!

      chosen.value = name
      speech.say(`${says} ${terms}.`)
    }

    return () => {
      const at    = SOURCES.findIndex(({ name }) => name === chosen.value)
      const style = { '--lit': at, '--sources': SOURCES.length, '--tone': toneOf(SOURCES[at]!) }

      return (
        <div class="source-lamps widget" ref={root} style={style}>
          <div aria-hidden class="source-lamps-wash" />
          <div {...api.value.getRootProps()} class="source-lamps-row group/row">
            <span {...api.value.getLabelProps()} class="sr-only">The sources the reading rests on</span>
            {...SOURCES.map((source) => (
              <label
                {...mergeProps(api.value.getItemProps({ value: source.name }), {
                  onPointerenter : (event: PointerEvent) => pauses.rest(event, source.name),
                  onPointerleave : pauses.dwell.stop
                })}
                class="source-lamps-lamp"
                style={{ '--tone': toneOf(source) }}
              >
                <span {...api.value.getItemControlProps({ value: source.name })} class="source-lamps-orb">
                  <svg aria-hidden class="block h-5.5 w-8 overflow-visible" viewBox="0 0 44 30">
                    {...MARKS[source.mark]()}
                  </svg>
                </span>
                <span {...api.value.getItemTextProps({ value: source.name })} class="source-lamps-name">
                  {source.name}
                </span>
                <span class="source-lamps-role widget-caps">{source.role}</span>
                <input {...api.value.getItemHiddenInputProps({ value: source.name })} />
              </label>
            ))}
          </div>
          <div class="source-lamps-slot">
            {layers(SOURCES.map(credit), at)}
          </div>
        </div>
      )
    }
  }
})

function credit(source: Source): VNode {
  const { link, mark, name, role, says, terms } = source

  return (
    <div class="source-lamps-credit" style={{ '--tone': toneOf(source) }}>
      <svg
        aria-hidden
        class="mt-0.5 block h-7.5 w-11 overflow-visible @max-lg:h-6 @max-lg:w-9"
        viewBox="0 0 44 30"
      >
        {...MARKS[mark]()}
      </svg>
      <div class="grid min-w-0 justify-items-start gap-1">
        <p class="m-0 widget-caps @lg:hidden">{role}</p>
        <p class="m-0 text-[0.92rem]/normal text-ink">{says}</p>
        <p class="m-0 mt-0.5 flex flex-wrap items-baseline gap-x-4.5 gap-y-0.5">
          <span class="widget-caps">{terms}</span>
          <a class="source-lamps-link" href={link} rel="noreferrer" target="_blank">
            <span class="sr-only">{`${name} at `}</span>
            {new URL(link).host}
            <span aria-hidden> ↗</span>
          </a>
        </p>
      </div>
    </div>
  )
}

function toneOf({ tone }: Source): string {
  return `var(--color-${tone})`
}
