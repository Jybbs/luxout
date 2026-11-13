import { useToggle }                                      from '@vueuse/core'
import { type VNode, defineComponent, shallowRef, useId } from 'vue'

import { data }                    from '../../../lib/daylight/cloud-steps.data.ts'
import { Announcer }               from '../../controls/announcer.tsx'
import { layers }                  from '../../controls/layers.tsx'
import { moreButton }              from '../../controls/more-button.tsx'
import { plotMarks }               from '../../controls/plot-marks.tsx'
import { PlotSlider, shareAcross } from '../../controls/plot-slider.ts'

const { floor, hours, opens, steps, strip } = data

const DASHED = 'outline-1 -outline-offset-1 outline-geometry outline-dashed'
const MARKS  = [
  'the-cloud-factor-marks absolute inset-0 size-full',
  '[&_:is(path,rect)]:[vector-effect:non-scaling-stroke]'
]
/**
 * The utilities filling each mark a bar and a swatch of the key draw in.
 */
const FILLS = {
  borrowed : `bg-cloud-borrowed ${DASHED}`,
  clear    : 'bg-sky-fill inset-ring inset-ring-ink',
  forecast : 'bg-forecast'
}
const KEYS = [
  { mark: 'clear', word: 'A clear sky’s sunlight' },
  { mark: 'forecast', word: 'The forecast’s sunlight' },
  { mark: 'borrowed', word: `Sun under ${floor}°, share borrowed` }
] as const

/**
 * Holds the step a reader picks from the strip and whether the arithmetic
 * behind it is open.
 */
class StepPicker {
  readonly announcer = new Announcer()
  readonly id        = useId()
  readonly index     = shallowRef(opens)
  readonly open      = shallowRef(false)
  readonly plot      = shallowRef<HTMLElement>()
  readonly slider    = new PlotSlider({
    count    : steps.length,
    page     : 4,
    position : (clientX) => this.#stepAt(clientX),
    value    : () => this.index.value,
    set      : (value) => {
      const step = steps[value]!

      this.index.value = value
      this.announcer.say(`${step.share}${step.lead}`)
    }
  })
  readonly toggle = useToggle(this.open)

  #stepAt(clientX: number): number {
    return Math.min(Math.floor(shareAcross(this.plot.value!, clientX) * steps.length), steps.length - 1)
  }
}

/**
 * Draws a clear sky's sunlight and the forecast's as two bars on one scale,
 * above a strip of every step's share to pick from, with the sum behind the
 * picked step opened on demand.
 */
export const TheCloudFactor = defineComponent({
  name: 'TheCloudFactor',
  setup() {
    const picker = new StepPicker()

    return () => {
      const index = picker.index.value
      const step  = steps[index]!

      return (
        <div class="widget the-cloud-factor grid gap-4">
          {layers(steps.map(leadWords), index)}
          <div
            aria-label={step.drawn}
            class={[
              'the-cloud-factor-bars grid grid-cols-[5.2rem_minmax(0,1fr)_6.6rem] items-center gap-x-3',
              'gap-y-2.5 @max-md:grid-cols-[4.6rem_minmax(0,1fr)_6.2rem] @max-md:gap-x-2',
              { borrowed: step.borrowed }
            ]}
            role="img"
          >
            {...barRow('clear', 'Clear sky', step)}
            {...barRow('forecast', 'Forecast', step)}
          </div>
          <div class="grid gap-1.5 pt-2">
            <span class="widget-caps">Each 15-minute step’s share · pick one</span>
            <div
              class="the-cloud-factor-strip relative cursor-pointer touch-pan-y"
              ref={picker.plot}
              style={{ height: `${strip.height}px` }}
              {...picker.slider.attributes('Forecast step', index, step.text)}
            >
              {stripMarks(index)}
              {...hours.map(({ word, x }) => (
                <span
                  class="widget-hour top-[33px] -translate-x-1/2 last:-translate-x-full"
                  style={{ left: `${x / strip.width * 100}%` }}
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
          <div
            class={[
              'the-cloud-factor-foot grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-t',
              'border-rule pt-3'
            ]}
          >
            <div id={picker.id}>
              {layers([keyRow(), layers(steps.map(howBody), index)], picker.open.value ? 1 : 0)}
            </div>
            {moreButton(
              picker.id,
              'How',
              picker.open.value,
              () => picker.toggle(),
              '@max-md:gap-0 @max-md:p-1.5 @max-md:text-[0px]'
            )}
          </div>
          {picker.announcer.region}
        </div>
      )
    }
  }
})

function barRow(kind: 'clear' | 'forecast', name: string, step: (typeof steps)[number]): VNode[] {
  return [
    <span class="text-[0.82rem]/[1.3] whitespace-nowrap text-muted">{name}</span>,
    <span class="relative h-3.5">
      <span
        class={[
          'absolute inset-y-0 left-0 rounded-xs transition-[width] duration-(--timing-settle)',
          step.borrowed ? DASHED : FILLS[kind]
        ]}
        style={{ width: `${step.bars[kind]}%` }}
      />
    </span>,
    <span
      class="the-cloud-factor-value widget-num text-right text-[0.84rem]/[1.3] font-medium whitespace-nowrap"
    >
      {step[kind]}
    </span>
  ]
}

function howBody({ how, sum }: (typeof steps)[number]): VNode {
  return (
    <div class="grid gap-1">
      <span class="the-cloud-factor-sum widget-num text-[0.9rem]/[1.4] font-medium">{sum}</span>
      <span class="text-[0.84rem]/[1.5] text-muted">{how}</span>
    </div>
  )
}

function keyRow(): VNode {
  return (
    <div
      class={[
        'the-cloud-factor-keys flex flex-wrap content-start gap-x-4.5 gap-y-1.5 text-[0.8rem]/[1.4]',
        'text-muted'
      ]}
    >
      {...KEYS.map(({ mark, word }) => (
        <span class="inline-flex items-center gap-1.75 whitespace-nowrap">
          <span class={['h-2 w-5.5 flex-none rounded-[1.5px]', FILLS[mark]]} />
          {word}
        </span>
      ))}
    </div>
  )
}

function leadWords({ lead, share }: (typeof steps)[number]): VNode {
  return (
    <p class="m-0 text-[1.12rem]/[1.5] text-pretty @max-md:text-[1.04rem]">
      <b
        class={[
          'the-cloud-factor-share font-display text-[1.45em]/0 font-semibold lining-nums',
          'whitespace-nowrap'
        ]}
      >
        {share}
      </b>
      {lead}
    </p>
  )
}

function stripMarks(index: number): VNode {
  const { axis, bar, full, height, pitch, width } = strip

  return plotMarks(MARKS, width, height, [
    <rect
      class="the-cloud-factor-picked fill-sunken"
      height={axis + 1}
      width={pitch}
      x={pitch * index}
      y={2}
    />,
    <path class="stroke-rule stroke-1" d={`M0 ${full}H${width}`} />,
    <path class="stroke-muted stroke-1" d={`M0 ${axis}H${width}`} />,
    ...steps.map(({ borrowed, top }, step) => (
      <rect
        class={[
          borrowed ? 'the-cloud-factor-borrowed fill-cloud-borrowed' : 'fill-forecast',
          step === index
            ? 'on stroke-ink stroke-[1.5]'
            : borrowed && 'stroke-geometry stroke-1 [stroke-dasharray:2_2]'
        ]}
        height={axis - top}
        width={bar}
        x={pitch * (step + 0.5) - bar / 2}
        y={top}
      />
    )),
    <path class="stroke-muted stroke-1" d={hours.map(({ x }) => `M${x} ${axis}V${axis + 4}`).join('')} />
  ])
}
