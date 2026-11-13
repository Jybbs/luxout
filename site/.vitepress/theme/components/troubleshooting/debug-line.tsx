import { type VNode, defineComponent, shallowRef, useId } from 'vue'

import type { DebugField, FieldKey } from '../../../lib/troubleshooting/debug-line.ts'
import { data }                      from '../../../lib/troubleshooting/debug-line.data.ts'
import { layers }                    from '../../controls/layers.tsx'
import { Tablist, tabPanel }         from '../../controls/tablist.tsx'

type Hue = DebugField['hue']

/**
 * The utilities the row of tiles and each tile take.
 */
const CLASSES = {
  list : 'grid min-w-0 grid-cols-4 gap-2.5 @max-lg:grid-cols-2',
  tab  : 'group min-w-0 cursor-pointer text-left focus-visible:rounded-[9px] focus-visible:outline-offset-3'
}
/**
 * The utilities filling the callout and a tile, a plain one taking a surface of
 * the page and any other mixing the share `--tint` of its wash into the raised
 * surface.
 */
const FILLS = {
  callout : { plain: 'bg-raised', sky: '[--tint:15%] dark:[--tint:16%]', tinted: '[--tint:7%]' },
  tile    : { plain: 'bg-sunken', sky: '[--tint:30%] dark:[--tint:16%]', tinted: '[--tint:13%]' }
}
/**
 * The edge and the wash each hue draws a tile, the callout, and a cell of the
 * map in.
 */
const HUES: Readonly<Record<Hue, string>> = {
  estimate : '[--edge:var(--color-estimate)] [--wash:var(--color-estimate)]',
  forecast : '[--edge:var(--color-forecast)] [--wash:var(--color-forecast)]',
  geometry : '[--edge:var(--color-geometry)] [--wash:var(--color-geometry)]',
  plain    : '[--edge:var(--color-rule)] [--wash:var(--color-muted)]',
  sky      : '[--edge:var(--color-sky-edge)] [--wash:var(--color-sky)]'
}
const MIX  = 'bg-[color-mix(in_srgb,var(--wash)_var(--tint),var(--color-raised))]'
const PANE = 'rounded-[10px] border-[1.5px] border-(--edge)'
const SPANS: Partial<Record<FieldKey, string>> = { stamp: 'span 2', steps: '1 / -1' }

const { fields, line } = data

const opening = fields.findIndex(({ key }) => key === 'reading')
const tabs    = fields.map(({ key, name, value }) => ({
  label : `${name}, ${value}`,
  style : { 'grid-column': SPANS[key] ?? 'auto' }
}))

/**
 * Sets a tile per field of the debug line beneath the line as the Homebridge
 * log prints it, each tile a tab in the hue its quantity takes, and the chosen
 * tile's note in a callout beside a map of the tiles marking where it sits.
 */
export const DebugLine = defineComponent({
  name: 'DebugLine',
  setup() {
    const id       = useId()
    const selected = shallowRef(opening)

    return () => {
      const chosen = fields[selected.value]!

      return (
        <div class="widget">
          <div
            class={[
              'grid min-w-0 gap-3.5 rounded-[10px] bg-raised px-5 pt-3 pb-5 font-mono text-[0.78rem]/[1.75]',
              'ring ring-rule @max-lg:px-3.5 @max-lg:pb-4 @max-lg:text-[0.74rem]'
            ]}
          >
            <div class="min-h-6.5 border-b border-rule pb-2">
              <span class="widget-caps">Homebridge log</span>
            </div>
            <p
              aria-hidden
              class={[
                'debug-line-raw m-0 border-b border-rule pb-3 font-mono text-[0.74rem]/[1.6] wrap-break-word',
                'text-muted'
              ]}
            >
              {line}
            </p>
            <p class="sr-only">{`The line reads ${line}`}</p>
            <Tablist
              classes={CLASSES}
              id={id}
              label="Fields of the debug line"
              onSelect={(index: number) => selected.value = index}
              selected={selected.value}
              tabs={tabs}
            >
              {{ default: ({ index }: { index: number }) => tile(fields[index]!) }}
            </Tablist>
            <div
              class={[
                'debug-line-callout flex min-w-0 items-center gap-3.5 px-3.5 pt-2.5 pb-2.75 @max-lg:gap-3',
                '@max-lg:px-3 transition-[border-color,background-color] duration-(--timing-fade)',
                PANE,
                HUES[chosen.hue],
                fill(chosen.hue, 'callout')
              ]}
              data-hue={chosen.hue}
            >
              <div
                aria-hidden
                class={[
                  'grid flex-none auto-rows-[6px] grid-cols-[repeat(4,10px)] gap-0.5',
                  '@max-lg:grid-cols-[repeat(2,10px)]'
                ]}
              >
                {...tabs.map(({ style }, index) => (
                  <i
                    class={[
                      'debug-line-cell rounded-[1.5px] transition-[background-color,box-shadow]',
                      'duration-(--timing-fade)',
                      index === selected.value
                        ? 'on bg-(--wash) inset-ring inset-ring-(--edge)'
                        : 'inset-ring inset-ring-muted'
                    ]}
                    style={style}
                  />
                ))}
              </div>
              <div
                {...tabPanel(id, selected.value)}
                class="debug-line-notes min-w-0 flex-1 [&_p]:m-0 [&_p]:font-base [&_p]:text-[0.94rem]/[1.5]"
              >
                {layers(fields.map(({ note }) => <p>{note}</p>), selected.value)}
              </div>
            </div>
          </div>
        </div>
      )
    }
  }
})

function fill(hue: Hue, part: keyof typeof FILLS): string {
  const fills = FILLS[part]

  return hue === 'plain' ? fills.plain : `${MIX} ${hue === 'sky' ? fills.sky : fills.tinted}`
}

function tile({ hue, name, value }: DebugField): VNode {
  return (
    <span
      class={[
        'grid h-full content-start gap-1.25 px-3 pt-2.25 pb-2.75 text-ink',
        'transition-shadow duration-(--timing-fade)',
        'group-data-selected:ring-3 group-data-selected:ring-(--wash)/34',
        PANE,
        HUES[hue],
        fill(hue, 'tile')
      ]}
    >
      <span
        aria-hidden
        class={[
          'font-mono text-[0.62rem]/[1.3] font-medium tracking-widest whitespace-nowrap uppercase',
          'text-muted transition-colors duration-(--timing-hover)',
          'group-hover:text-ink group-data-selected:text-ink'
        ]}
      >
        {name}
      </span>
      <span aria-hidden class="widget-num text-[0.9rem]/[1.25] font-medium wrap-anywhere">{value}</span>
    </span>
  )
}
