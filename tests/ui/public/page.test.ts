/** @vitest-environment happy-dom */
import { readFile } from 'node:fs/promises'
import { join }     from 'node:path'

import { RequestError }               from '@homebridge/plugin-ui-utils'
import type { PluginConfig }          from '@homebridge/plugin-ui-utils/ui.interface'
import { MockHomebridgePluginUi }     from '@homebridge/plugin-ui-utils/ui.mock'
import { screen }                     from '@testing-library/dom'
import { userEvent }                  from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

import schema              from '../../../config.schema.json' with { type: 'json' }
import { Geocoder }        from '../../../src/ui/geocoder.js'
import { LocationService } from '../../../src/ui/location.js'
import { LocationPage }    from '../../../src/ui/public/page.js'
import { answering }       from '../../common/fetch.js'
import { boston }          from '../../common/places.js'
import search              from '../fixtures/search.json' with { type: 'json' }

const ADDISON = 'Addison, Texas, United States'
const BOSTON  = {
  latitude  : boston.latitude,
  longitude : boston.longitude,
  name      : 'Daylight',
  place     : { country: 'United States', name: 'Boston', region: 'Massachusetts' },
  platform  : 'Luxout'
}
const LOUVRE  = 'Paris 01 Louvre, Île-de-France Region, France'
const PARIS   = 'Paris, Île-de-France Region, France'
const markup  = join(import.meta.dirname, '../../../src/ui/public/index.html')

/**
 * Stands in for the `window.homebridge` the Homebridge UI injects, answering
 * each path the server script registers through the location service it runs
 * and rejecting a failed request with the message and the error the UI hands
 * the page, or with `Not Found` for a path the server script never registers.
 */
class Homebridge extends MockHomebridgePluginUi {
  readonly #language : string
  readonly #service  : LocationService

  constructor(blocks: PluginConfig[], fetch: typeof globalThis.fetch, language: string) {
    super()
    this.#language        = language
    this.#service         = new LocationService(new Geocoder(fetch))
    this.mockPluginConfig = blocks
    this.mockPluginSchema = schema
  }

  override async i18nCurrentLang(): Promise<string> {
    return this.#language
  }

  override async request(path: string, body?: unknown): Promise<{}> {
    try {
      switch (path) {
        case '/check'  : return structuredClone(this.#service.check(body))
        case '/search' : return structuredClone(await this.#service.search(body))
        default        : throw { message: 'Not Found', path }
      }
    } catch (error) {
      throw error instanceof RequestError ? { error: error.requestError, message: error.message } : error
    }
  }
}

beforeEach(async () => {
  document.body.innerHTML = await readFile(markup, 'utf8')
})

it('shows the generated form below the page as it opens', async () => {
  const { form } = await open()

  expect(form).toHaveBeenCalledOnce()
})

it('shows the coordinates and the place the block keeps as the page opens', async () => {
  await open()

  expect(kept()).toStrictEqual({
    latitude  : '42.36',
    longitude : '−71.06',
    place     : 'Boston, Massachusetts, United States'
  })
  expect(screen.getByText('No place kept yet').hidden).toBe(true)
})

it('shows the hint in place of the coordinates where the block keeps none', async () => {
  await open({ blocks: [] })

  expect(kept()).toStrictEqual({ latitude: '', longitude: '', place: '' })
  expect(screen.getByText('No place kept yet').hidden).toBe(false)
})

it('hands the UI nothing as it opens, so the block stands as the form holds it', async () => {
  const { update } = await open()

  expect(update).not.toHaveBeenCalled()
})

it('holds the UI’s spinner until a search answers, then lists each match by its label', async () => {
  const pending                = Promise.withResolvers<Response>()
  const { hide, show, submit } = await open({ fetch: vi.fn<typeof fetch>().mockReturnValue(pending.promise) })

  await submit('75001')

  expect(show).toHaveBeenCalledOnce()
  expect(hide).not.toHaveBeenCalled()

  pending.resolve(Response.json(search))

  expect(await labels()).toStrictEqual([PARIS, ADDISON, LOUVRE])
  expect(hide).toHaveBeenCalledOnce()
  expect(screen.getByText('Matches appear here').hidden).toBe(true)
})

it('sends no search for an empty query', async () => {
  const fetch             = answering(Response.json(search))
  const { submit, toast } = await open({ fetch })

  await submit(' ')

  expect(fetch).not.toHaveBeenCalled()
  expect(toast).not.toHaveBeenCalled()
})

it('searches in the language the Homebridge UI runs in', async () => {
  const fetch      = answering(Response.json(search))
  const { submit } = await open({ fetch, language: 'pt-BR' })

  await submit('Paris')
  await labels()

  expect(fetch.mock.calls[0]?.[0]).toContain('&language=pt&')
})

it('shows a failed search’s message through the UI’s toast and lists no match', async () => {
  const { hide, submit, toast } = await open({ fetch: answering(Response.json({})) })

  await submit('SW1A 1AA')

  await vi.waitFor(() => {
    expect(toast).toHaveBeenCalledExactlyOnceWith(
      'No place matches “SW1A 1AA”, so search by the city’s name instead'
    )
  })
  expect(hide).toHaveBeenCalledOnce()
  expect(screen.getByText('Matches appear here').hidden).toBe(false)
  expect(screen.queryByRole('listbox')).toBeNull()
})

it('keeps the match the user clicks, through the check, in the whole block it hands the UI', async () => {
  const { update, user } = await searched()

  await user.click(option(ADDISON))

  await vi.waitFor(() => {
    expect(update).toHaveBeenCalledExactlyOnceWith([{
      ...BOSTON,
      latitude  : 32.96,
      longitude : -96.83,
      place     : { country: 'United States', name: 'Addison', region: 'Texas' }
    }])
  })
  expect(option(ADDISON).getAttribute('aria-selected')).toBe('true')
  expect(kept()).toStrictEqual({ latitude: '32.96', longitude: '−96.83', place: ADDISON })
})

it.each([
  { keys: '{ArrowDown}', selected: ADDISON },
  { keys: '{ArrowDown}{ArrowUp}', selected: PARIS },
  { keys: '{ArrowUp}', selected: PARIS },
  { keys: '{End}', selected: LOUVRE },
  { keys: '{End}{ArrowDown}', selected: LOUVRE },
  { keys: '{End}{Home}', selected: PARIS },
  { keys: '{Enter}', selected: PARIS },
  { keys: '[Space]', selected: PARIS }
])('keeps the match $keys selects from the option the Tab key lands on', async ({ keys, selected }) => {
  const { update, user } = await searched()
  const prevented: boolean[] = []

  await user.tab()
  await user.tab()
  screen.getByRole('listbox').addEventListener('keydown', (event) => prevented.push(event.defaultPrevented))

  expect(document.activeElement).toBe(option(PARIS))

  await user.keyboard(keys)

  expect(document.activeElement).toBe(option(selected, true))
  expect(new Set(prevented)).toStrictEqual(new Set([true]))
  expect([...document.querySelectorAll('.list-group-item-highlight')]).toStrictEqual([option(selected, true)])
  await vi.waitFor(() => {
    expect(kept().place).toBe(selected)
  })
  expect(update).toHaveBeenLastCalledWith([
    expect.objectContaining({ place: expect.objectContaining({ name: selected.split(',')[0] }) })
  ])
})

it('lets every other key through the listbox, so Tab leaves it with nothing kept', async () => {
  const { update, user } = await searched()

  await user.tab()
  await user.tab()
  await user.keyboard('{a}')
  await user.tab()

  expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Weather data by Open-Meteo.com' }))
  expect(screen.queryByRole('option', { selected: true })).toBeNull()
  expect(update).not.toHaveBeenCalled()
})

it('keeps the place the block holds in view while a new search lists its matches', async () => {
  await searched()

  expect(kept()).toStrictEqual({
    latitude  : '42.36',
    longitude : '−71.06',
    place     : 'Boston, Massachusetts, United States'
  })
})

it('clears the matches a search listed once the user types coordinates', async () => {
  const { submit, user } = await searched()

  await user.clear(screen.getByRole('searchbox'))
  await submit('48.85, 2.35')

  expect(screen.queryByRole('listbox')).toBeNull()
  expect(screen.getByText('Matches appear here').hidden).toBe(false)
})

it.each(['42.35843, -71.05977', '42.35843 -71.05977', '42.35843,-71.05977', ' +42.35843 , −71.05977 '])(
  'keeps the typed coordinates %j without a search, clearing the kept place',
  async (typed) => {
    const fetch              = answering(Response.json(search))
    const { submit, update } = await open({ fetch })

    await submit(typed)

    await vi.waitFor(() => {
      expect(update).toHaveBeenCalledExactlyOnceWith([{ ...BOSTON, place: undefined }])
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(kept().place).toBe('')
  }
)

it('fails typed coordinates past the bounds with the check’s message, keeping the block', async () => {
  const { submit, toast, update } = await open()

  await submit('91, 0')

  await vi.waitFor(() => {
    expect(toast).toHaveBeenCalledExactlyOnceWith(
      'Coordinates take a latitude from -90 to 90 and a longitude from -180 to 180'
    )
  })
  expect(update).not.toHaveBeenCalled()
  expect(kept().latitude).toBe('42.36')
})

it('writes back each change the form below the page reported before the page’s own', async () => {
  const { homebridge, update, user } = await searched()

  homebridge.dispatchEvent(new MessageEvent('configChanged', { data: [{ ...BOSTON, name: 'Outdoors' }] }))
  await user.click(option(PARIS))

  await vi.waitFor(() => {
    expect(update).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ latitude: 48.85, longitude: 2.35, name: 'Outdoors' })
    ])
  })
})

it('writes back a change the form below reported while the check answered', async () => {
  const { homebridge, update, user } = await searched()
  const request                      = homebridge.request.bind(homebridge)

  vi.spyOn(homebridge, 'request').mockImplementation(async (path, body) => {
    homebridge.dispatchEvent(new MessageEvent('configChanged', { data: [{ ...BOSTON, name: 'Outdoors' }] }))

    return request(path, body)
  })
  await user.click(option(PARIS))

  await vi.waitFor(() => {
    expect(update).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ latitude: 48.85, longitude: 2.35, name: 'Outdoors' })
    ])
  })
})

it('builds a block on the platform the schema names where the plugin has none yet', async () => {
  const { update, user } = await searched({ blocks: [] })

  await user.click(option(ADDISON))

  await vi.waitFor(() => {
    expect(update).toHaveBeenCalledExactlyOnceWith([{
      latitude  : 32.96,
      longitude : -96.83,
      place     : { country: 'United States', name: 'Addison', region: 'Texas' },
      platform  : schema.pluginAlias
    }])
  })
})

it('sets the name of a match apart in semibold, in its option and in the place kept', async () => {
  const { user } = await searched()

  await user.click(option(ADDISON))

  await vi.waitFor(() => {
    expect(kept().place).toBe(ADDISON)
  })

  const names = [option(ADDISON), screen.getByRole('status', { name: 'Place' })]
    .map((node) => node.querySelector('strong.fw-semibold')?.textContent)

  expect(names).toStrictEqual(['Addison', 'Addison'])
})

it('writes each name a search returns as text, whatever markup it holds', async () => {
  const name       = '<img src=x onerror=alert(1)>'
  const body       = { results: [{ ...search.results[0], name }] }
  const { submit } = await open({ fetch: answering(Response.json(body)) })

  await submit('Paris')

  expect(await labels()).toStrictEqual([`${name}, Île-de-France Region, France`])
  expect(document.querySelector('img')).toBeNull()
})

it.each([
  { href: 'https://open-meteo.com/', name: 'Weather data by Open-Meteo.com' },
  { href: 'https://creativecommons.org/licenses/by/4.0/', name: 'CC BY 4.0' }
])('credits Open-Meteo with a link to $href that opens apart from the settings', async ({ href, name }) => {
  await open()

  expect(screen.getByRole('link', { name })).toMatchObject({ href, rel: 'noopener', target: '_blank' })
})

it('links the stylesheet plugin:build copies beside the page', () => {
  expect(document.querySelector('link[rel="stylesheet"]')?.getAttribute('href')).toBe('index.css')
})

it('credits GeoNames for the location data', async () => {
  await open()

  expect(screen.getByText('Location data from GeoNames').closest('[hidden]')).toBeNull()
})

it('fails to open on markup missing a part of the page, naming the part', async () => {
  document.getElementById('unkept')?.remove()

  await expect(open()).rejects.toThrow(new TypeError('The page holds no #unkept'))
})

/**
 * Reads the latitude, the longitude, and the place the page shows as kept.
 */
function kept(): Record<'latitude' | 'longitude' | 'place', string> {
  const read = (name: string): string => screen.getByRole('status', { name }).textContent.trim()

  return { latitude: read('Latitude'), longitude: read('Longitude'), place: read('Place') }
}

/**
 * Waits for the listbox and reads the label of each option it lists.
 */
async function labels(): Promise<string[]> {
  const options = await screen.findAllByRole('option')

  return options.map((option) => option.textContent.trim())
}

/**
 * Opens the page on `blocks`, answering each search through `fetch` in
 * `language`, with a spy on each call to the Homebridge UI a case reads.
 */
async function open({
  blocks   = [BOSTON] as PluginConfig[],
  fetch    = answering(Response.json(search)),
  language = 'en'
} = {}) {
  const homebridge = new Homebridge(blocks, fetch, language)
  const spies      = {
    form   : vi.spyOn(homebridge, 'showSchemaForm'),
    hide   : vi.spyOn(homebridge, 'hideSpinner'),
    show   : vi.spyOn(homebridge, 'showSpinner'),
    toast  : vi.spyOn(homebridge.toast, 'error'),
    update : vi.spyOn(homebridge, 'updatePluginConfig')
  }

  await LocationPage.open(document, homebridge)

  const user = userEvent.setup()

  return {
    ...spies,
    homebridge : homebridge,
    submit     : (text: string) => user.type(screen.getByRole('searchbox'), `${text}{Enter}`),
    user       : user
  }
}

/**
 * Finds the option whose text reads `label`, selected where `selected` says so.
 */
function option(label: string, selected?: boolean): HTMLElement {
  return screen.getByRole('option', { name: (_, element) => element.textContent.trim() === label, selected })
}

/**
 * Opens the page and searches for `75001`, which the fixture answers with
 * Paris, Addison, and the Louvre.
 */
async function searched(options: Parameters<typeof open>[0] = {}) {
  const opened = await open(options)

  await opened.submit('75001')
  await labels()

  return opened
}
