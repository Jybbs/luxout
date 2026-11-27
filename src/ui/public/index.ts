import { LocationPage } from './page.js'

window.homebridge.addEventListener('ready', () => {
  LocationPage.open(document, window.homebridge).catch((error: unknown) => {
    window.homebridge.toast.error(error instanceof Error ? error.message : String(error))
  })
})
