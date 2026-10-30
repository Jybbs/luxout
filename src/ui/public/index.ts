import { LocationPage } from './page.js'

window.homebridge.addEventListener('ready', () => {
  LocationPage.open(document, window.homebridge).catch(console.error)
})
