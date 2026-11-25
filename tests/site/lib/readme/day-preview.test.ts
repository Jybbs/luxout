import { expect, it, vi } from 'vitest'

import { Faces }         from '../../../../site/.vitepress/lib/cards/faces.ts'
import { SampleDay }     from '../../../../site/.vitepress/lib/daylight/sample-day.ts'
import { DayPreview }    from '../../../../site/.vitepress/lib/readme/day-preview.ts'
import { ForecastSteps } from '../../../../site/.vitepress/lib/readme/lanes.ts'
import { dialDrawing }   from '../../../../site/.vitepress/theme/components/daylight/dial-drawing.tsx'
import { vitepress }     from '../../common/paths.ts'

const preview = await DayPreview.read(vitepress, dialDrawing)
const step    = new ForecastSteps(SampleDay.record()).steps.find(({ borrowed, held }) => !borrowed && !held)!

it('sets the forecast lane’s words in capitals, each W/m² keeping its own case', () => {
  const say = vi.spyOn(Faces.prototype, 'say')

  preview.frame(step.minute, 'light')

  const said = say.mock.calls.map(([text]) => text)

  expect(said).toContain(`STEP ${step.clock} · ${step.forecast} ÷ ${step.clear}`)
  expect(step.forecast).toMatch(/ W\/m²$/)
  expect(said.join('\n')).not.toContain('W/M²')
})
