import type { Gap, GapSensor } from '../../lib/daylight/gap.ts'
import type { DecadeScale }    from '../../lib/daylight/lux-scale.ts'
import type { SearchReplay }   from '../../lib/search/replay.ts'
import type { SettingRow }     from '../../lib/settings/rows.ts'

type Cell = number | string

function markdownTable(headers: readonly string[], rows: readonly (readonly Cell[])[]): string {
  const line = (cells: readonly Cell[]) => `| ${cells.join(' | ')} |`
  const head = line(headers.map((header) => `**${header}**`))

  return [head, `|${'---|'.repeat(headers.length)}`, ...rows.map(line)].join('\n')
}

/**
 * Replaces the text between each pair of named comment markers with the block
 * of that name, failing on a name the page does not mark.
 */
export function fillMarkers(source: string, blocks: Readonly<Record<string, string>>): string {
  return Object.entries(blocks).reduce((page, [name, block]) => {
    const open  = `<!-- ${name} -->`
    const close = `<!-- /${name} -->`
    const start = page.indexOf(open)
    const end   = page.indexOf(close)

    if (start < 0 || end < start) throw new Error(`The page marks no block named ${name}`)

    return `${page.slice(0, start + open.length)}\n\n${block}\n\n${page.slice(end)}`
  }, source)
}

/**
 * Writes the two sensors as the Markdown table a page keeps for GitHub.
 */
export function gapTable({ sensors, span }: Gap): string {
  const row = (name: string, cell: (sensor: GapSensor) => Cell) => [name, ...sensors.map(cell)]

  return markdownTable(
    [`From ${span[0]} to ${span[1]}`, ...sensors.map(({ name }) => name)],
    [
      row('On at', ({ onAt }) => `${onAt} lux`),
      row('Off below', ({ offBelow }) => `${offBelow} lux`),
      row('Switches', ({ switches }) => switches),
      row('Switches at', ({ times }) => times.join(', '))
    ]
  )
}

/**
 * Writes the decades as the Markdown table a page keeps for GitHub.
 */
export function luxTable({ date, decades }: DecadeScale): string {
  const rows = decades.map(({ clearSky, day, everyday, range }) => [
    range,
    everyday.map(({ lux, name }) => `${name} at ${lux}`).join(', '),
    clearSky,
    day
  ])

  return markdownTable(['Lux', 'Everyday Light', 'Clear Sky', date], rows)
}

/**
 * Writes the replay as the Markdown table a page keeps for GitHub.
 */
export function searchTable({ stages }: SearchReplay): string {
  const rows = stages.map(({ code, label, name, note, shows }) => {
    const sent = code.map((line) => line.trim())
      .join(' ')
      .replaceAll(' &', '&')

    return [name, shows, [label, sent && `\`${sent}\``, note].filter(Boolean).join('. ')]
  })

  return markdownTable(['Stage', 'The Settings Page', 'What Crosses'], rows)
}

/**
 * Writes the rows as the Markdown table a page keeps for GitHub.
 */
export function settingsTable(rows: readonly SettingRow[]): string {
  return markdownTable(
    ['Key', 'Title', 'Type', 'Default', 'What It Does', 'Without It'],
    rows.map(({ does, fallback, key, needed, title, type, without }) => [
      `\`${key}\``,
      title,
      type,
      fallback,
      does,
      `${needed ? 'Needed' : 'Optional'}, and without it, ${without}`
    ])
  )
}

/**
 * Writes the levels of a threshold entry as the Markdown list a page keeps for
 * GitHub.
 */
export function thresholdLevels(rows: readonly SettingRow[]): string {
  const prefix = 'thresholds[].'

  return rows.filter(({ key }) => key.startsWith(prefix))
    .map(({ does, key, title }) => `- \`${key.slice(prefix.length)}\`, the ${title} field. ${does}.`)
    .join('\n')
}
