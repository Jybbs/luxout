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
  readonly widget  : string
  /**
   * The image the widget opens on, which the page keeps for GitHub.
   */
  readonly frame?: string
  /**
   * Whether the widget's slot holds the section's words ahead of its table.
   */
  readonly words?: boolean
}

export type WidgetName = (typeof ROWS)[number]['widget']

const ROWS = [
  {
    fold    : 'Each stretch as a table',
    frame   : './day-estimate.svg',
    heading : 'A Day of the Reading',
    page    : 'estimate/index.md',
    widget  : 'DayEstimate'
  },
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
    fold    : 'Each named day as a table',
    frame   : './sun-path.svg',
    heading : "The Sun's Height Through the Day",
    page    : 'estimate/altitude.md',
    widget  : 'SunPath',
    words   : true
  },
  {
    fold    : 'Each step as a table',
    heading : 'The Share the Clouds Let Through',
    page    : 'estimate/cloud-factor.md',
    widget  : 'TheCloudFactor'
  },
  {
    fold    : 'The two sensors as a table',
    frame   : './the-gap.svg',
    heading : 'The Gap',
    page    : 'sensors/thresholds.md',
    widget  : 'TheGap'
  },
  {
    fold    : 'The three terms as a table',
    heading : 'Three Factors',
    page    : 'estimate/index.md',
    widget  : 'ThreeFactors'
  },
  {
    fold    : 'Each altitude as a table',
    frame   : './twilight-bridge.svg',
    heading : 'The Twilight Bridge',
    page    : 'estimate/clear-sky.md',
    widget  : 'TwilightBridge'
  }
] as const satisfies readonly Placement[]
export const PLACEMENTS: readonly Placement[] = ROWS
export const WIDGET_NAMES                     = PLACEMENTS.map(({ widget }) => widget)
