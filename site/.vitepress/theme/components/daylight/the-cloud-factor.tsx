import { useToggle }                                      from '@vueuse/core'
import { type VNode, defineComponent, shallowRef, useId } from 'vue'

import { data }                    from '../../../lib/daylight/cloud-steps.data.ts'
import { Announcer }               from '../../controls/announcer.tsx'
import { layers }                  from '../../controls/layers.tsx'
import { moreButton }              from '../../controls/more-button.tsx'
import { plotMarks }               from '../../controls/plot-marks.tsx'
import { PlotSlider, shareAcross } from '../../controls/plot-slider.ts'

import './styles/the-cloud-factor.css'

const { floor, hours, opens, steps, strip } = data

const KEYS = [
  { mark: 'clear', word: 'A clear sky’s sunlight' },
  { mark: 'forecast', word: 'The forecast’s sunlight' },
  { mark: 'borrowed', word: `Sun under ${floor}°, share borrowed` }
]

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
        <div class="widget the-cloud-factor">
          {layers(steps.map(leadWords), index)}
          <div
            aria-label={step.drawn}
            class={['the-cloud-factor-bars', { borrowed: step.borrowed }]}
            role="img"
          >
            {...barRow('clear', 'Clear sky', step)}
            {...barRow('forecast', 'Forecast', step)}
          </div>
          <div class="the-cloud-factor-picker">
            <span class="widget-caps">Each 15-minute step’s share · pick one</span>
            <div
              class="the-cloud-factor-strip"
              ref={picker.plot}
              style={{ height: `${strip.height}px` }}
              {...picker.slider.attributes('Forecast step', index, step.text)}
            >
              {stripMarks(index)}
              {...hours.map(({ word, x }) => (
                <span class="the-cloud-factor-hour" style={{ left: `${x / strip.width * 100}%` }}>
                  {word}
                </span>
              ))}
            </div>
          </div>
          <div class="the-cloud-factor-foot">
            <div id={picker.id}>
              {layers([keyRow(), layers(steps.map(howBody), index)], picker.open.value ? 1 : 0)}
            </div>
            {moreButton(picker.id, 'How', picker.open.value, () => picker.toggle())}
          </div>
          {picker.announcer.region}
        </div>
      )
    }
  }
})

function barRow(kind: 'clear' | 'forecast', name: string, step: (typeof steps)[number]): VNode[] {
  return [
    <span class="the-cloud-factor-label">{name}</span>,
    <span class="the-cloud-factor-lane">
      <span
        class={`the-cloud-factor-bar the-cloud-factor-${kind}`}
        style={{ width: `${step.bars[kind]}%` }}
      />
    </span>,
    <span class="the-cloud-factor-value widget-num">{step[kind]}</span>
  ]
}

function howBody({ how, sum }: (typeof steps)[number]): VNode {
  return (
    <div class="the-cloud-factor-how">
      <span class="the-cloud-factor-sum widget-num">{sum}</span>
      <span class="the-cloud-factor-why">{how}</span>
    </div>
  )
}

function keyRow(): VNode {
  return (
    <div class="the-cloud-factor-keys">
      {...KEYS.map(({ mark, word }) => (
        <span class="the-cloud-factor-key">
          <span class={`the-cloud-factor-swatch the-cloud-factor-${mark}`} />
          {word}
        </span>
      ))}
    </div>
  )
}

function leadWords({ lead, share }: (typeof steps)[number]): VNode {
  return (
    <p class="the-cloud-factor-lead">
      <b class="the-cloud-factor-share">{share}</b>
      {lead}
    </p>
  )
}

function stripMarks(index: number): VNode {
  const { axis, bar, full, height, pitch, width } = strip

  return plotMarks('the-cloud-factor-marks', width, height, [
    <rect class="the-cloud-factor-picked" height={axis + 1} width={pitch} x={pitch * index} y={2} />,
    <path class="the-cloud-factor-grid" d={`M0 ${full}H${width}`} />,
    <path class="the-cloud-factor-axis" d={`M0 ${axis}H${width}`} />,
    ...steps.map(({ borrowed, top }, step) => (
      <rect
        class={[`the-cloud-factor-${borrowed ? 'borrowed' : 'forecast'}`, { on: step === index }]}
        height={axis - top}
        width={bar}
        x={pitch * (step + 0.5) - bar / 2}
        y={top}
      />
    )),
    <path class="the-cloud-factor-axis" d={hours.map(({ x }) => `M${x} ${axis}V${axis + 4}`).join('')} />
  ])
}
