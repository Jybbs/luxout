import { useMounted }                                     from '@vueuse/core'
import { bisectRight, cumsum }                            from 'd3-array'
import { type VNode, defineComponent, shallowRef, useId } from 'vue'

import { FrameClock }                   from '../../../lib/motion/frame-clock.ts'
import { motionReduced }                from '../../../lib/motion/timing.ts'
import type { SearchPage, SearchStage } from '../../../lib/search/replay.ts'
import { data }                         from '../../../lib/search/search.data.ts'
import { Announcer }                    from '../../controls/announcer.tsx'
import { layers }                       from '../../controls/layers.tsx'
import { Tablist, tabPanel }            from '../../controls/tablist.tsx'

import './styles/location-search.css'

const { labels } = data
const spoken     = data.stages.map(({ label, name, note }, index) =>
  `Stage ${index + 1}, ${name}. ${label}. ${note}`.replaceAll('`', '').trim()
)
const stops = cumsum(data.stages.slice(0, -1), ({ hold }) => hold)
const tabs  = data.stages.map(({ name }, index) => ({ label: `${index + 1}, ${name}` }))

/**
 * Steps through the replay, holding each stage long enough to read and typing
 * the query one character at a time, and stopping on the last stage.
 */
class Player {
  readonly announcer = new Announcer()
  readonly id        = useId()
  readonly mounted   = useMounted()
  readonly panel     = shallowRef<HTMLElement>()

  readonly play = (): void => {
    this.#started = performance.now()
    this.#show(0)
    this.#clock.start()
  }

  readonly select = (index: number): void => {
    this.#clock.stop()
    this.#show(index)
  }

  readonly stage  = shallowRef(data.stages.length - 1)
  readonly typed  = shallowRef<number>()
  readonly #clock = new FrameClock(this.panel, (now) => this.#tick(now))
  #started        = 0

  #show(index: number): void {
    this.stage.value = index
    this.typed.value = undefined
    this.announcer.say(spoken[index]!)
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
      <div class="widget location-search">
        <div class="location-search-bar">
          <Tablist
            id={player.id}
            label="Stages of the search"
            name="location-search"
            onSelect={player.select}
            selected={player.stage.value}
            tabs={tabs}
          >
            {{
              default: ({ index }: { index: number }) => [
                <span class="location-search-number">{index + 1}</span>,
                <span class="location-search-name">{data.stages[index]!.name}</span>
              ]
            }}
          </Tablist>
          <button
            class="location-search-play"
            disabled={player.mounted.value && motionReduced()}
            onClick={player.play}
            type="button"
          >
            Play
          </button>
        </div>
        <div {...tabPanel(player.id, player.stage.value)} class="location-search-panel" ref={player.panel}>
          {settingsPage(data.stages[player.stage.value]!.page, player.typed.value)}
          {layers(data.stages.map(wire), player.stage.value)}
        </div>
        {player.announcer.region}
      </div>
    )
  }
})

function caps(text: string): VNode {
  return <span class="widget-caps">{text}</span>
}

function credit(source: string): VNode {
  return <span>{link(source)}{` ${labels.under} `}{link(labels.license)}</span>
}

function link(words: string): VNode {
  return <span class="location-search-link">{words}</span>
}

function part(area: string, children: VNode[]): VNode {
  return <div class={`location-search-part location-search-${area}`}>{...children}</div>
}

function placeName(): VNode {
  return (
    <span class="location-search-place">
      {...data.place.flatMap((piece, index, { length }) => {
        const text = index < length - 1 ? `${piece},` : piece

        return index
          ? [' ', <span class="location-search-whole">{text}</span>]
          : ['', <b class="location-search-whole">{text}</b>]
      })}
    </span>
  )
}

function settingsPage({ activity, input, match }: SearchPage, typed?: number): VNode {
  const kept  = match === 'chosen'
  const shown = typed === undefined ? input : data.query.slice(0, typed)

  return (
    <div aria-hidden class={['location-search-page', activity]}>
      <div class="location-search-parts">
        {part('query', [
          caps(labels.search),
          <span class="location-search-field">
            <span class="location-search-input">
              {shown || <span class="location-search-hint">{labels.placeholder}</span>}
              {activity === 'typing' && <span class="location-search-caret" />}
            </span>
            <span class="location-search-button">{labels.button}</span>
          </span>
        ])}
        {part('matches', [
          caps(labels.matches),
          <div class="location-search-list">
            {layers(
              [
                <span class="location-search-hint location-search-empty">{labels.empty}</span>,
                <span class={['location-search-match', { chosen: kept }]}>
                  <span class="location-search-radio" />
                  {placeName()}
                </span>
              ],
              match === 'none' ? 0 : 1
            )}
          </div>
        ])}
        {part('stored', [
          <span class="location-search-pair">{caps(labels.latitude)}{caps(labels.longitude)}</span>,
          layers(
            [
              <span class="location-search-hint location-search-none">{labels.none}</span>,
              <span class="location-search-pair">
                <span class="location-search-figure">{data.latitude}</span>
                <span class="location-search-figure">{data.longitude}</span>
              </span>
            ],
            kept ? 1 : 0
          )
        ])}
        <span class="location-search-rule" />
        {part('kept', [caps(labels.place), layers([<span />, placeName()], kept ? 1 : 0)])}
        {part('credit', [
          caps(labels.attribution),
          <span class="location-search-credits">{credit(labels.weather)}{credit(labels.geonames)}</span>
        ])}
      </div>
      <div class="location-search-form">
        {caps(data.field)}
        <span class="location-search-box" />
      </div>
      <div class="location-search-foot"><span class="location-search-save">Save</span></div>
      <span class="location-search-spinner"><span /></span>
    </div>
  )
}

function wire({ code, label, note }: SearchStage): VNode {
  return (
    <div class="location-search-sent">
      <span class="location-search-heading widget-caps">{...words(label)}</span>
      {code.length
        ? <pre class="location-search-code">{...code.map((line) => <span>{line}</span>)}</pre>
        : undefined}
      {note ? <p class="widget-note">{...words(note)}</p> : undefined}
    </div>
  )
}

function words(text: string): (VNode | string)[] {
  return text.split('`').map((piece, index) => index % 2 ? <code>{piece}</code> : piece)
}
