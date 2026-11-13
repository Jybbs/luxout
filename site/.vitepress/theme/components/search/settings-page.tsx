import type { VNode } from 'vue'

import type { SearchPage } from '../../../lib/search/replay.ts'
import { data }            from '../../../lib/search/search.data.ts'
import { layers }          from '../../controls/layers.tsx'

const BUTTON = 'inline-flex flex-none items-center rounded-lg px-4'
const CAPS   = 'font-mono text-[0.68rem]/[1.4] font-semibold tracking-widest uppercase'
const LINE   = 'inset-ring inset-ring-page-line'
/**
 * Sets where each part of the settings page sits in its grid, and the rule
 * each draws once the page splits into two columns.
 */
const PARTS = {
  credit  : [
    '[grid-area:credit] @md:grid-cols-[auto_minmax(0,1fr)] @md:items-baseline @md:gap-x-4',
    '@md:border-t @md:border-rule @md:pt-4'
  ],
  kept    : 'location-search-kept [grid-area:kept]',
  matches : '[grid-area:matches]',
  query   : '[grid-area:query]',
  stored  : 'location-search-stored [grid-area:stored] border-t border-rule pt-5 @md:border-t-0 @md:pt-0'
}

const { labels } = data

function caps(text: string): VNode {
  return <span class="widget-caps">{text}</span>
}

function credit(source: string): VNode {
  return <span>{link(source)}{` ${labels.under} `}{link(labels.license)}</span>
}

function figure(value: string): VNode {
  return (
    <span
      class={[
        'location-search-figure font-display text-[2.1rem]/[40px] font-semibold whitespace-nowrap',
        'lining-nums tabular-nums'
      ]}
    >
      {value}
    </span>
  )
}

function link(words: string): VNode {
  return <span class="whitespace-nowrap text-accent underline decoration-1 underline-offset-2">{words}</span>
}

function part(area: keyof typeof PARTS, children: VNode[]): VNode {
  return <div class={['grid min-w-0 content-start gap-2', PARTS[area]]}>{...children}</div>
}

function placeName(): VNode {
  return (
    <span class="[&_b]:font-semibold">
      {...data.place.flatMap((piece, index, { length }) => {
        const text = index < length - 1 ? `${piece},` : piece

        return index
          ? [' ', <span class="location-search-whole whitespace-nowrap">{text}</span>]
          : ['', <b class="location-search-whole whitespace-nowrap">{text}</b>]
      })}
    </span>
  )
}

/**
 * Draws the settings page as it stands at one stage of the replay, the search
 * field holding the first `typed` characters of the query while the stage
 * types it.
 */
export function settingsPage({ activity, input, match }: SearchPage, typed?: number): VNode {
  const kept  = match === 'chosen'
  const shown = typed === undefined ? input : data.query.slice(0, typed)

  return (
    <div
      aria-hidden
      class={[
        'location-search-page relative grid overflow-clip rounded-xl bg-raised font-base',
        'text-[0.95rem]/[1.45] font-normal',
        'ring ring-rule shadow-[0_22px_44px_-30px_var(--color-shadow)]',
        '[--page-padding:18px] @md:[--page-padding:24px]'
      ]}
      data-activity={activity}
    >
      <div
        class={[
          'grid grid-cols-[minmax(0,1fr)] gap-5 px-(--page-padding) pt-5 pb-5.5',
          "[grid-template-areas:'query'_'matches'_'stored'_'kept'_'credit']",
          '@md:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] @md:gap-x-6 @md:gap-y-5.5 @md:py-5.5',
          "@md:[grid-template-areas:'query_rule_stored'_'matches_rule_kept'_'credit_credit_credit']"
        ]}
      >
        {part('query', [
          caps(labels.search),
          <span class="flex min-w-0 gap-2">
            <span
              class={[
                'location-search-input flex h-10 min-w-0 flex-1 items-center overflow-clip rounded-lg',
                'bg-ground px-3 font-mono text-[0.86rem]/none font-normal whitespace-nowrap',
                'transition-shadow duration-(--timing-hover)',
                activity === 'typing' ? 'inset-ring-[1.5px] inset-ring-accent ring-3 ring-accent/22' : LINE
              ]}
            >
              {shown || <span class="text-muted">{labels.placeholder}</span>}
              {activity === 'typing' && (
                <span class="location-search-caret ml-px h-[1.1em] w-[1.5px] flex-none bg-ink" />
              )}
            </span>
            <span class={[BUTTON, CAPS, 'h-10 text-ink inset-ring inset-ring-ink']}>
              {labels.button}
            </span>
          </span>
        ])}
        {part('matches', [
          caps(labels.matches),
          <div class={['location-search-list rounded-[10px] p-1', LINE]}>
            {layers(
              [
                <span class="block p-2 text-muted">{labels.empty}</span>,
                <span
                  class={[
                    'location-search-match grid grid-cols-[14px_minmax(0,1fr)] items-start gap-2.5',
                    'rounded-[7px] p-2 transition-[background-color] duration-(--timing-fade)',
                    { 'chosen bg-accent/10': kept }
                  ]}
                >
                  <span
                    class={[
                      'mt-1 size-3.5 rounded-full transition-shadow duration-(--timing-fade)',
                      kept
                        ? 'inset-ring-4 inset-ring-accent'
                        : 'inset-ring-[1.5px] inset-ring-muted'
                    ]}
                  />
                  {placeName()}
                </span>
              ],
              match === 'none' ? 0 : 1
            )}
          </div>
        ])}
        {part('stored', [
          <span class="grid grid-cols-2 gap-x-4">{caps(labels.latitude)}{caps(labels.longitude)}</span>,
          layers(
            [
              <span class="leading-[40px] text-muted">{labels.none}</span>,
              <span class="grid grid-cols-2 gap-x-4">
                {figure(data.latitude)}
                {figure(data.longitude)}
              </span>
            ],
            kept ? 1 : 0
          )
        ])}
        <span class="hidden w-px bg-rule [grid-area:rule] @md:block" />
        {part('kept', [caps(labels.place), layers([<span />, placeName()], kept ? 1 : 0)])}
        {part('credit', [
          caps(labels.attribution),
          <span class="location-search-credits flex flex-wrap gap-x-3.5 gap-y-0.5 text-[0.86rem] text-muted">
            {credit(labels.weather)}
            {credit(labels.geonames)}
          </span>
        ])}
      </div>
      <div
        class={[
          'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 border-t border-rule',
          'px-(--page-padding) py-3.5'
        ]}
      >
        {caps(data.field)}
        <span class={['h-9 rounded-lg bg-ground', LINE]} />
      </div>
      <div class="flex justify-end border-t border-rule px-(--page-padding) py-3">
        <span
          class={[
            BUTTON,
            CAPS,
            'h-9 bg-ink text-ground transition-shadow duration-(--timing-fade)',
            { 'ring-3 ring-ink/35': activity === 'saving' }
          ]}
        >
          Save
        </span>
      </div>
      <span
        class={[
          'pointer-events-none absolute inset-0 grid place-items-center bg-raised/70 transition-opacity',
          'duration-(--timing-fade)',
          activity === 'spinning' ? 'opacity-100' : 'opacity-0'
        ]}
      >
        <span
          class={[
            'size-7 rounded-full border-[2.5px] border-ink border-r-transparent',
            { 'motion-safe:animate-turn': activity === 'spinning' }
          ]}
        />
      </span>
    </div>
  )
}
