/**
 * One section of the site, in reading order, with the question its overview
 * answers and the sentence saying what it holds.
 */
export interface Section {
  asks  : string
  holds : string
  label : string
  slug  : string
  /**
   * Whether the sidebar keeps the overview's order rather than the alphabet's.
   */
  curated?: boolean
}

export const SECTIONS: readonly Section[] = [
  {
    asks    : 'How do I install Luxout and point it at my place?',
    curated : true,
    holds   : 'This section takes you from installing the plugin through the Homebridge UI to the Outside '
            + 'sensor in the Home app.',
    label   : 'Install',
    slug    : 'install'
  },
  {
    asks  : 'What does Luxout add to Apple Home, and what does each sensor read?',
    holds : 'This section covers the sensors the plugin registers, the lux each one reads, and how a '
          + 'threshold sensor switches.',
    label : 'Sensors',
    slug  : 'sensors'
  },
  {
    asks  : 'What can I change, and what does each setting do?',
    holds : 'This section lists every setting the platform block takes, what each one does, and what happens '
          + 'without it.',
    label : 'Settings',
    slug  : 'settings'
  },
  {
    asks  : 'Where does the reading come from, and where does it stop?',
    holds : 'This section covers the altitude of the sun, the clear-sky curve, the cloud factor, the '
          + 'forecast window, what the reading uses while fetches fail, the limits of an estimate, and the '
          + 'bibliography that credits its sources.',
    label : 'Estimate',
    slug  : 'estimate'
  },
  {
    asks  : 'What does Luxout send, and what does it keep?',
    holds : 'This section covers the request the plugin sends each hour, the place each request carries, '
          + 'the search the settings page sends, and the one file the plugin keeps.',
    label : 'Privacy',
    slug  : 'privacy'
  },
  {
    asks    : 'What do I do when a reading looks wrong?',
    curated : true,
    holds   : 'This section walks a reading that looks wrong from the limits of the estimate through debug '
            + 'logging and the debug line to a bug report.',
    label   : 'Troubleshooting',
    slug    : 'troubleshooting'
  }
]
