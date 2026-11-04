import { useMounted }                                        from '@vueuse/core'
import { bisectRight, cumsum }                               from 'd3-array'
import { type VNode, defineComponent, h, shallowRef, useId } from 'vue'

import { FrameClock }                   from '../../../lib/motion/frame-clock.ts'
import { motionReduced }                from '../../../lib/motion/timing.ts'
import type { SearchPage, SearchStage } from '../../../lib/search/replay.ts'
import { data }                         from '../../../lib/search/search.data.ts'
import { Announcer }                    from '../../controls/announcer.ts'
import { layers }                       from '../../controls/layers.ts'
import { Tablist, tabPanel }            from '../../controls/tablist.ts'

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
    const faces  = {
      default: ({ index }: { index: number }) => [
        h('span', { class: 'location-search-number' }, index + 1),
        h('span', { class: 'location-search-name' }, data.stages[index]!.name)
      ]
    }

    return () => h('div', { class: 'widget location-search' }, [
      h('div', { class: 'location-search-bar' }, [
        h(
          Tablist,
          {
            id       : player.id,
            label    : 'Stages of the search',
            name     : 'location-search',
            onSelect : player.select,
            selected : player.stage.value,
            tabs     : tabs
          },
          faces
        ),
        h(
          'button',
          {
            class    : 'location-search-play',
            disabled : player.mounted.value && motionReduced(),
            onClick  : player.play,
            type     : 'button'
          },
          'Play'
        )
      ]),
      h(
        'div',
        { ...tabPanel(player.id, player.stage.value), class: 'location-search-panel', ref: player.panel },
        [
          settingsPage(data.stages[player.stage.value]!.page, player.typed.value),
          layers(data.stages.map(wire), player.stage.value)
        ]
      ),
      player.announcer.region
    ])
  }
})

function caps(text: string): VNode {
  return h('span', { class: 'widget-caps' }, text)
}

function credit(source: string): VNode {
  return h('span', [link(source), ` ${labels.under} `, link(labels.license)])
}

function link(words: string): VNode {
  return h('span', { class: 'location-search-link' }, words)
}

function part(area: string, children: VNode[]): VNode {
  return h('div', { class: `location-search-part location-search-${area}` }, children)
}

function placeName(): VNode {
  return h('span', { class: 'location-search-place' }, data.place.flatMap((piece, index, { length }) => [
    index ? ' ' : '',
    h(index ? 'span' : 'b', { class: 'location-search-whole' }, index < length - 1 ? `${piece},` : piece)
  ]))
}

function settingsPage({ activity, input, match }: SearchPage, typed?: number): VNode {
  const kept  = match === 'chosen'
  const shown = typed === undefined ? input : data.query.slice(0, typed)

  return h('div', { 'aria-hidden': true, class: ['location-search-page', activity] }, [
    h('div', { class: 'location-search-parts' }, [
      part('query', [
        caps(labels.search),
        h('span', { class: 'location-search-field' }, [
          h(
            'span',
            { class: 'location-search-input' },
            shown || h('span', { class: 'location-search-hint' }, labels.placeholder)
          ),
          h('span', { class: 'location-search-button' }, labels.button)
        ])
      ]),
      part('matches', [
        caps(labels.matches),
        h('div', { class: 'location-search-list' }, layers(
          [
            h('span', { class: 'location-search-hint location-search-empty' }, labels.empty),
            h('span', { class: ['location-search-match', { chosen: kept }] }, [
              h('span', { class: 'location-search-radio' }),
              placeName()
            ])
          ],
          match === 'none' ? 0 : 1
        ))
      ]),
      part('stored', [
        h('span', { class: 'location-search-pair' }, [caps(labels.latitude), caps(labels.longitude)]),
        layers(
          [
            h('span', { class: 'location-search-hint location-search-none' }, labels.none),
            h('span', { class: 'location-search-pair' }, [
              h('span', { class: 'location-search-figure' }, data.latitude),
              h('span', { class: 'location-search-figure' }, data.longitude)
            ])
          ],
          kept ? 1 : 0
        )
      ]),
      h('span', { class: 'location-search-rule' }),
      part('kept', [caps(labels.place), layers([h('span'), placeName()], kept ? 1 : 0)]),
      part('credit', [
        caps(labels.attribution),
        h('span', { class: 'location-search-credits' }, [credit(labels.weather), credit(labels.geonames)])
      ])
    ]),
    h('div', { class: 'location-search-form' }, [
      caps(data.field),
      h('span', { class: 'location-search-box' })
    ]),
    h('div', { class: 'location-search-foot' }, [h('span', { class: 'location-search-save' }, 'Save')]),
    h('span', { class: 'location-search-spinner' }, h('span'))
  ])
}

function wire({ code, label, note }: SearchStage): VNode {
  return h('div', { class: 'location-search-sent' }, [
    h('span', { class: 'location-search-heading widget-caps' }, words(label)),
    code.length
      ? h('pre', { class: 'location-search-code' }, code.map((line) => h('span', line)))
      : undefined,
    note ? h('p', { class: 'widget-note' }, words(note)) : undefined
  ])
}

function words(text: string): (VNode | string)[] {
  return text.split('`').map((piece, index) => index % 2 ? h('code', piece) : piece)
}
