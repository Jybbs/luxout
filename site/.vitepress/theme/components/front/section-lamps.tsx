import { defineComponent, shallowRef, useId } from 'vue'

import { SECTIONS } from '../../../lib/config/sections.ts'
import { layers }   from '../../controls/layers.tsx'
import { Pauses }   from '../../controls/pauses.ts'

/**
 * Holds the lamp a reader has reached, which a mouse resting on a lamp reaches
 * after the dwell pause and the focus reaches at once.
 */
class Reach {
  readonly at = shallowRef(0)

  readonly #pauses = new Pauses((index: number) => { this.at.value = index })

  enter(event: PointerEvent, index: number): void {
    this.#pauses.rest(event, index)
  }

  focus(index: number): void {
    this.#pauses.stop()
    this.at.value = index
  }

  leave(): void {
    this.#pauses.dwell.stop()
  }
}

/**
 * Hangs one lamp per section on a rail in reading order, each naming the
 * question its section answers, and lights the lamp a reader reaches, its beam
 * falling on a plate that says what that section holds.
 */
export const SectionLamps = defineComponent({
  name: 'SectionLamps',
  setup() {
    const halo  = useId()
    const plate = useId()
    const reach = new Reach()

    return () => {
      const at = reach.at.value

      return (
        <div class="section-lamps widget" style={{ '--lamps': SECTIONS.length, '--reached': at }}>
          <svg aria-hidden class="absolute size-0">
            <radialGradient id={halo}>
              <stop offset="0" stop-color="var(--color-sky)" stop-opacity="0.85" />
              <stop offset="1" stop-color="var(--color-sky)" stop-opacity="0" />
            </radialGradient>
          </svg>
          <ol class="section-lamps-row">
            {...SECTIONS.map(({ asks, label, slug }, index) => (
              <li class="section-lamps-lamp" data-lit={index === at || undefined}>
                <a
                  aria-describedby={`${plate}-${index}`}
                  href={`/${slug}/`}
                  onFocus={() => reach.focus(index)}
                  onPointerenter={(event: PointerEvent) => reach.enter(event, index)}
                  onPointerleave={() => reach.leave()}
                >
                  <svg aria-hidden class="section-lamps-art" viewBox="0 0 64 76">
                    <circle class="section-lamps-halo" cx="32" cy="58" fill={`url(#${halo})`} r="26" />
                    <path class="section-lamps-cord" d="M32 0V30" />
                    <path class="section-lamps-shade" d="M25 30H39L52 52H12Z" />
                    <ellipse class="section-lamps-inner" cx="32" cy="52" rx="20" ry="2.6" />
                    <circle class="section-lamps-bulb" cx="32" cy="57.5" r="5" />
                  </svg>
                  <span class="section-lamps-label widget-caps">{`${numbered(index)} · ${label}`}</span>
                  <span class="section-lamps-asks">{asks}</span>
                </a>
              </li>
            ))}
          </ol>
          <div class="section-lamps-plate">
            <div aria-hidden class="section-lamps-pool" />
            {layers(SECTIONS.map(({ holds, label, slug }, index) => (
              <div class="section-lamps-holds" id={`${plate}-${index}`}>
                <p class="m-0 text-[0.92rem]/[1.45] text-ink">
                  <span class="mr-2.5 widget-caps">{`${numbered(index)} · ${label}`}</span>
                  {holds}
                </p>
                <a class="section-lamps-open" href={`/${slug}/`} tabindex={-1}>{`Open ${label}`}</a>
              </div>
            )), at)}
          </div>
        </div>
      )
    }
  }
})

function numbered(index: number): string {
  return String(index + 1).padStart(2, '0')
}
