import { expect, it, vi } from 'vitest'

import { Faces }         from '../../../lib/cards/faces.ts'
import { SampleDay }     from '../../../lib/daylight/sample-day.ts'
import { DayPreview }    from '../../../lib/readme/day-preview.ts'
import { ForecastSteps } from '../../../lib/readme/lanes.ts'
import { dialDrawing }   from '../../../theme/components/daylight/dial-drawing.tsx'

const preview = await DayPreview.read(new URL('../../../', import.meta.url), dialDrawing)
const step    = new ForecastSteps(SampleDay.record()).steps.find(({ borrowed, held }) => !borrowed && !held)!

it('sets the forecast lane’s words in capitals, each W/m² keeping its own case', () => {
  const say = vi.spyOn(Faces.prototype, 'say')

  preview.frame(step.minute, 'light')

  const said = say.mock.calls.map(([text]) => text)

  expect(said).toContain(`STEP ${step.clock} · ${step.forecast} ÷ ${step.clear}`)
  expect(step.forecast).toMatch(/ W\/m²$/)
  expect(said.join('\n')).not.toContain('W/M²')
})
