import { useMounted }                                     from '@vueuse/core'
import { bisectRight, cumsum }                            from 'd3-array'
import { type VNode, defineComponent, shallowRef, useId } from 'vue'

import { FrameClock }        from '../../../lib/motion/frame-clock.ts'
import { Speech }            from '../../../lib/motion/speech.ts'
import { motionReduced }     from '../../../lib/motion/timing.ts'
import type { SearchStage }  from '../../../lib/search/replay.ts'
import { data }              from '../../../lib/search/search.data.ts'
import { codeSpans }         from '../../controls/code-spans.tsx'
import { layers }            from '../../controls/layers.tsx'
import { Tablist, tabPanel } from '../../controls/tablist.tsx'
import { settingsPage }      from './settings-page.tsx'

/**
 * The utilities the tablist and each stage's tab take, a tab narrowing to its
 * number alone once the widget narrows, unless it is the chosen one.
 */
const CLASSES = {
  list : '-ms-1 flex flex-wrap items-center',
  tab  : [
    'group inline-flex items-center gap-1.75 rounded-full py-1 pr-2.5 pl-1 font-mono text-[0.68rem]/none',
    'font-medium tracking-[0.08em] text-muted uppercase focus-visible:outline-offset-1',
    'data-selected:text-ink @max-md:not-data-selected:pr-1'
  ]
}
const spoken = data.stages.map(({ label, name, note }, index) =>
  `Stage ${index + 1}, ${name}. ${label}. ${note}`.replaceAll('`', '').trim()
)
const stops = cumsum(data.stages.slice(0, -1), ({ hold }) => hold)
const tabs  = data.stages.map(({ name }, index) => ({ label: `${index + 1}, ${name}` }))

/**
 * Steps through the replay, holding each stage long enough to read and typing
 * the query one character at a time, and stopping on the last stage.
 */
class Player {
  readonly id      = useId()
  readonly mounted = useMounted()
  readonly panel   = shallowRef<HTMLElement>()

  readonly play = (): void => {
    this.#started = performance.now()
    this.#show(0)
    this.#clock.start()
  }

  readonly select = (index: number): void => {
    this.#clock.stop()
    this.#show(index)
  }

  readonly root   = shallowRef<HTMLElement>()
  readonly speech = new Speech(this.root)
  readonly stage  = shallowRef(data.stages.length - 1)
  readonly typed  = shallowRef<number>()
  readonly #clock = new FrameClock(this.panel, (now) => this.#tick(now))
  #started        = 0

  #show(index: number): void {
    this.stage.value = index
    this.typed.value = undefined
    this.speech.say(spoken[index]!)
  }

  #tick(now: number): boolean {
    const elapsed = now - this.#started
    const index   = bisectRight(stops, elapsed)
    const typing  = data.stages[index]!.page.activity === 'typing'

    if (this.stage.value !== index) this.#show(index)

    this.typed.value = typing ? Math.floor((elapsed - stops[index - 1]!) / data.character) + 1 : undefined

    return index < stops.length
  }
}

/**
 * Replays a search on the settings page with no network against a recorded
 * geocoding answer, with what crosses at each stage beneath the page at its
 * full width.
 */
export const LocationSearch = defineComponent({
  name: 'LocationSearch',
  setup() {
    const player = new Player()

    return () => (
      <div class="widget location-search grid gap-4" ref={player.root}>
        <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          <Tablist
            classes={CLASSES}
            id={player.id}
            label="Stages of the search"
            onSelect={player.select}
            selected={player.stage.value}
            tabs={tabs}
          >
            {{
              default: ({ index }: { index: number }) => [
                <span
                  class={[
                    'inline-grid size-5.5 place-items-center rounded-full tracking-normal',
                    'inset-ring inset-ring-rule transition-[background-color,color]',
                    'duration-(--timing-hover) group-data-selected:bg-ink group-data-selected:text-ground',
                    'group-data-selected:inset-ring-0'
                  ]}
                >
                  {index + 1}
                </span>,
                <span class="@max-md:hidden @max-md:group-data-selected:inline">
                  {data.stages[index]!.name}
                </span>
              ]
            }}
          </Tablist>
          <button
            class={[
              'widget-pill location-search-play transition-[border-color] duration-(--timing-hover)',
              'focus-visible:outline-offset-1 enabled:hover:border-ink'
            ]}
            disabled={player.mounted.value && motionReduced()}
            onClick={player.play}
            type="button"
          >
            Play
          </button>
        </div>
        <div
          {...tabPanel(player.id, player.stage.value)}
          class="grid grid-cols-[minmax(0,1fr)] items-start gap-5"
          ref={player.panel}
        >
          {settingsPage(data.stages[player.stage.value]!.page, player.typed.value)}
          {layers(data.stages.map(wire), player.stage.value)}
        </div>
      </div>
    )
  }
})

function wire({ code, label, note }: SearchStage): VNode {
  return (
    <div class="location-search-sent grid content-start gap-2">
      <span
        class={[
          'widget-caps flex flex-wrap items-baseline gap-x-1.5 [&_code]:bg-transparent [&_code]:p-0',
          '[&_code]:font-mono [&_code]:text-[0.74rem]/[1.45] [&_code]:font-medium [&_code]:tracking-normal',
          '[&_code]:normal-case'
        ]}
      >
        {...codeSpans(label)}
      </span>
      {code.length
        ? (
          <pre
            class={[
              'location-search-code m-0 min-w-0 rounded-lg bg-sunken p-2.5 font-mono text-[0.76rem]/[1.6]',
              'font-normal wrap-anywhere whitespace-pre-wrap *:block'
            ]}
          >
            {...code.map((line) => <span>{line}</span>)}
          </pre>
        )
        : undefined}
      {note ? <p class="widget-note">{...codeSpans(note)}</p> : undefined}
    </div>
  )
}
