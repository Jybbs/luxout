import { onKeyStroke } from '@vueuse/core'
import { type VNode, defineComponent, onMounted, shallowRef, useId, watch } from 'vue'

import { data }                          from '../../../lib/front/front.data.ts'
import { useFrontFacts, useFrontMinute } from '../../../lib/front/minute.ts'
import { Readout }                       from '../../../lib/front/readout.ts'
import { Disclosure }                    from '../../controls/disclosure.tsx'
import { Pauses }                        from '../../controls/pauses.ts'

const ASSUMED = 'hidden group-data-assumed:inline'
const NAMED   = 'group-data-assumed:hidden'
const SWATCH  = 'mr-1.5 inline-block size-2 rounded-[2px] align-[0.05em]'
const noon    = data.day.noon

/**
 * Opens the reading's card while a pointer rests on the reading and closes it
 * the leave pause after the pointer goes, unless a press has pinned it open,
 * which a second press or Escape undoes.
 */
class ReadingCard {
  readonly disclosure : Disclosure
  readonly id         = useId()
  readonly open       = shallowRef(false)
  readonly root       = shallowRef<HTMLElement>()

  readonly onPointerenter = (): void => {
    this.#pauses.leave.stop()

    if (!this.open.value) this.#pauses.dwell.start()
  }

  readonly onPointerleave = (): void => {
    this.#pauses.dwell.stop()

    if (!this.#pinned) this.#pauses.leave.start()
  }

  #pinned         = false
  readonly #pauses = new Pauses(() => { this.open.value = true }, () => { this.open.value = false })

  constructor() {
    this.disclosure = new Disclosure(this.id, this.open, () => this.#press())

    onKeyStroke('Escape', () => this.#close(), { target: this.root })
    onMounted(() => {
      const facts   = useFrontFacts()
      const readout = new Readout(this.root.value!)

      watch(useFrontMinute(), (minute) => readout.write(facts[Math.round(minute)]!), { immediate: true })
    })
  }

  #close(): void {
    if (!this.open.value) return

    this.#pinned    = false
    this.open.value = false
    this.root.value!.querySelector('button')!.focus()
  }

  #press(): void {
    this.#pauses.stop()
    this.#pinned    = !(this.open.value && this.#pinned)
    this.open.value = this.#pinned
  }
}

/**
 * Shows the reading at the hero's minute in the sky's corner, opening a card
 * that sets out the sun's altitude, the clear sky, the cloud factor, and the
 * reading they make.
 */
export const HeroReading = defineComponent({
  name: 'HeroReading',
  setup() {
    const card = new ReadingCard()
    const at   = useFrontFacts()[noon]!

    return () => (
      <div
        class={[
          'front-reading group absolute top-[calc(var(--vp-nav-height)+14px)] left-4 z-3 @md:left-6',
          { open: card.open.value }
        ]}
        onPointerenter={card.onPointerenter}
        onPointerleave={card.onPointerleave}
        ref={card.root}
      >
        <button
          {...card.disclosure.trigger}
          class={[
            'inline-flex items-center gap-2 rounded-full bg-raised/80 py-1 pr-2.75 pl-2.25 font-mono',
            'text-[0.7rem]/[1.4] font-medium whitespace-nowrap text-ink tabular-nums',
            'shadow-[0_0_0_1px_var(--color-rule)] backdrop-blur-sm cursor-pointer',
            'group-[.open]:shadow-[0_0_0_1px_var(--color-ink)] hover:shadow-[0_0_0_1px_var(--color-ink)]'
          ]}
        >
          <span class="sr-only">The reading at </span>
          <span class="font-semibold" data-fact="time">{at.time}</span>
          <span class="text-muted"><span data-fact="reading">{at.reading}</span> lux</span>
        </button>
        <div
          aria-label="The reading in full"
          class={[
            'absolute top-[calc(100%+8px)] left-0 w-62 max-w-[calc(100cqi-40px)] rounded-[10px] bg-raised/90',
            'px-3.5 pt-3 pb-2.5 shadow-[0_0_0_1px_var(--color-rule),0_14px_30px_-18px_var(--color-shadow)]',
            'backdrop-blur-md transition-[opacity,translate] duration-(--timing-fade)',
            card.open.value ? 'translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0'
          ]}
          id={card.id}
          inert={!card.open.value}
          role="group"
        >
          <p class="m-0 mb-2 flex items-baseline justify-between gap-2">
            <b class="widget-time" data-fact="time">{at.time}</b>
            <span class="widget-caps" data-fact="phase">{at.phase}</span>
          </p>
          <dl class="m-0 grid grid-cols-[auto_auto] justify-between gap-x-4 gap-y-1 text-[0.86rem]/[1.4]">
            {row('bg-geometry', 'Sun', <span data-fact="sun">{at.sun}</span>)}
            {row('bg-sky', 'Clear sky', lux(<span data-fact="clear">{at.clear}</span>))}
            <dt class="text-muted">
              <span class={NAMED}><span aria-hidden class={[SWATCH, 'bg-forecast']} />Cloud factor</span>
              <span class={ASSUMED}><span aria-hidden class={[SWATCH, 'bg-fallback']} />No forecast</span>
            </dt>
            <dd class="m-0 text-right widget-num">
              <span class={NAMED} data-fact="factor">{at.factor ?? '1'}</span>
              <span class={ASSUMED}>1, the clear sky</span>
            </dd>
            {row('bg-estimate', 'Reading', lux(<span data-fact="reading">{at.reading}</span>))}
          </dl>
          <p class="m-0 mt-2.25 widget-caps text-[0.6rem]">{`${data.place} · ${data.date}`}</p>
        </div>
      </div>
    )
  }
})

function lux(figure: VNode): VNode {
  return <>{figure} lux</>
}

function row(swatch: string, name: string, value: VNode): VNode[] {
  return [
    <dt class="text-muted"><span aria-hidden class={[SWATCH, swatch]} />{name}</dt>,
    <dd class="m-0 text-right widget-num">{value}</dd>
  ]
}
