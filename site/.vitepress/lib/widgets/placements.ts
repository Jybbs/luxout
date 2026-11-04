/**
 * Where one widget stands on the site.
 */
export interface Placement {
  /**
   * The summary of the table the widget folds shut beneath it.
   */
  readonly fold    : string
  readonly heading : string
  readonly page    : string
  readonly widget  : WidgetName
  /**
   * The image the widget opens on, which the page keeps for GitHub.
   */
  readonly frame?: string
  /**
   * Whether the widget's slot holds the section's words ahead of its table.
   */
  readonly words?: boolean
}

export type WidgetName = (typeof WIDGET_NAMES)[number]

export const PLACEMENTS: readonly Placement[] = [
  {
    fold    : 'Each stage as a table',
    heading : 'Searching for a Zip Code',
    page    : 'install/place.md',
    widget  : 'LocationSearch'
  },
  {
    fold    : 'Each decade as a table',
    heading : 'Nine Decades of Lux',
    page    : 'sensors/outside.md',
    widget  : 'LuxScale',
    words   : true
  },
  {
    fold    : 'Every setting as a table',
    heading : 'Settings Reference',
    page    : 'settings/index.md',
    widget  : 'SettingsReference'
  },
  {
    fold    : 'The two sensors as a table',
    frame   : './the-gap.svg',
    heading : 'The Gap',
    page    : 'sensors/thresholds.md',
    widget  : 'TheGap'
  }
]
export const WIDGET_NAMES = ['LocationSearch', 'LuxScale', 'SettingsReference', 'TheGap'] as const
