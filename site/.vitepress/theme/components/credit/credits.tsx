import { type VNode, defineComponent, useId } from 'vue'

import { type CreditRow, creditRows }        from '../../../lib/credit/credit.ts'
import { data }                              from '../../../lib/credit/credit.data.ts'
import { SEAL, type SealColor, sealDrawing } from '../../../lib/credit/seal-drawing.ts'

/**
 * Sets the seal beside the section's words and the credit's labeled rows,
 * the seal rising beside the section's heading wherever the column holds the
 * two side by side.
 */
export const Credits = defineComponent({
  name: 'Credits',
  setup(_, { slots }) {
    const clip = `seal-sun-${useId()}`

    return () => (
      <div
        class={[
          'widget credits grid grid-cols-[minmax(0,1fr)] gap-4',
          'sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-x-6 sm:[h2:has(+&)]:pl-30'
        ]}
      >
        <svg
          aria-hidden="true"
          class="credits-seal block size-24 overflow-visible sm:row-span-2 sm:-mt-12"
          viewBox={`0 0 ${SEAL.size} ${SEAL.size}`}
        >
          {...sealDrawing(clip, data, (color: SealColor) => `var(--color-${color})`)}
        </svg>
        <div class="credits-words [&_p]:m-0 [&_p]:text-muted [&_p]:italic">
          {...(slots.default?.() ?? [])}
        </div>
        <dl
          class={[
            'm-0 grid grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2',
            '[&>dd]:m-0 [&>dd]:min-w-0 [&>dd]:[overflow-wrap:anywhere]'
          ]}
        >
          {...creditRows().flatMap((row) => [
            <dt class="widget-caps">{row.label}</dt>,
            <dd>{value(row)}</dd>
          ])}
        </dl>
      </div>
    )
  }
})

function value({ code, detail, href, value: text }: CreditRow): (VNode | string)[] {
  if (detail) return detail.split('`').map((part, at) => at % 2 ? <code>{part}</code> : part)

  return [...code ? [<code>{code}</code>, ' '] : [], href ? <a href={href}>{text}</a> : text]
}
