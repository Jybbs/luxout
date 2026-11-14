/**
 * One labeled row of the credit, its value linked where `href` names an
 * address and led by the field `code` names where it changes one, and the
 * sentence the site sets in its place, in Markdown code spans, where `detail`
 * holds one.
 */
export interface CreditRow {
  label    : string
  value    : string
  code?    : string
  detail?  : string
  href?    : string
}

/**
 * The Open-Meteo credit the README and the Bibliography page set out, with the
 * rows its license requires, the source, the creator, the license, and the
 * change the plugin makes, the DOI's metadata at doi.org giving the creator,
 * the publisher, and the year.
 */
export const CREDIT = {
  creator   : 'Patrick Zippenfenig',
  doi       : '10.5281/zenodo.7970649',
  heading   : 'Credits',
  lede      : 'The forecast behind every reading, and the terms it is shared under.',
  license   : { href: 'https://creativecommons.org/licenses/by/4.0/', text: 'CC BY 4.0' },
  publisher : 'Zenodo',
  source    : { href: 'https://open-meteo.com/', text: 'Weather data by Open-Meteo.com' },
  step      : '15 min',
  variable  : 'shortwave_radiation_instant',
  year      : 2024
}

/**
 * Writes the credit as the one sentence a screen reader announces for an image
 * of it.
 */
export function creditLabel({ creator, heading, lede, license, publisher, source, year } = CREDIT): string {
  return `${heading}. ${lede} ${source.text}, ${creator}, ${publisher}, ${year}, ${license.text}.`
}

/**
 * Writes the words the seal's rim carries, the creator's surname across the
 * top and the year and the license across the bottom.
 */
export function creditRim({ creator, license, year } = CREDIT): { bottom: string, top: string } {
  return { bottom: `${year} · ${license.text}`, top: creator.split(' ').at(-1)!.toUpperCase() }
}

/**
 * Lists the credit's labeled rows in the order each place sets them out.
 */
export function creditRows(
  { creator, doi, license, publisher, source, step, variable, year } = CREDIT
): CreditRow[] {
  return [
    { href: source.href, label: 'Data', value: source.text },
    { href: `https://doi.org/${doi}`, label: 'DOI', value: doi },
    { label: 'Creators', value: creator },
    { label: 'Published', value: `${publisher}, ${year}` },
    { href: license.href, label: 'License', value: license.text },
    {
      code   : variable,
      detail : `Reads \`${variable}\` at each \`${step}\` step`
             + ' and divides it by a clear sky’s to give the cloud factor',
      label  : 'Changed',
      value  : '÷ clear sky'
    }
  ]
}
