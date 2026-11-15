import { defineComponent, shallowRef } from 'vue'

import { data }   from '../../../lib/identity/identity.data.ts'
import { Pauses } from '../../controls/pauses.ts'

/**
 * The utilities each line takes by its name: the tagline as the front page
 * opens on it, the byline as body text.
 */
const LOOKS: Readonly<Record<string, string>> = {
  Byline  : 'max-w-[40rem] text-[1.05rem]/[1.5] text-muted',
  Tagline : 'text-balance italic text-[clamp(1.1rem,2.5cqi,1.4rem)]/[1.3] text-ink'
}

/**
 * The tagline over the byline, each under a rule with its caption beneath, the
 * line a mouse rests on or the focus reaches lit and the other dimmed.
 */
export const WordsCaptioned = defineComponent({
  name: 'WordsCaptioned',
  setup() {
    const lit    = shallowRef<number | null>(null)
    const light  = (index: number | null) => { lit.value = index }
    const pauses = new Pauses(light, () => light(null))

    return () => (
      <div class="widget words-captioned grid" onPointerleave={() => pauses.leave.start()}>
        {...data.lines.map(({ face, name, text, where }, index) => (
          <div
            class={[
              'grid gap-2.5 border-t border-rule py-2.5 font-base',
              'transition-opacity duration-(--timing-fade)',
              lit.value !== null && lit.value !== index ? 'opacity-55' : 'opacity-100'
            ]}
            onBlur={() => light(null)}
            onFocus={() => light(index)}
            onPointerenter={(event: PointerEvent) => {
              pauses.leave.stop()
              pauses.rest(event, index)
            }}
            onPointerleave={pauses.dwell.stop}
            tabindex={0}
          >
            <p class={['m-0', LOOKS[name]]}>{text}</p>
            <span class="widget-caps">{[name, face, where].filter(Boolean).join(' · ')}</span>
          </div>
        ))}
      </div>
    )
  }
})
