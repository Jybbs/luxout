# Installing *Luxout*

`homebridge-luxout` is a plugin for [Homebridge](https://homebridge.io) that needs no hardware, no account, and no API key, since its reading comes from the sun's position and from [Open-Meteo](https://open-meteo.com/en/docs)'s forecast.

## Supported Versions

Version {{ $frontmatter.package.version }} runs on Homebridge <code>{{ $frontmatter.package.engines.homebridge }}</code> under [Node](https://nodejs.org) <code>{{ $frontmatter.package.engines.node }}</code>, and the plugin's settings page opens inside the [Homebridge UI](https://www.npmjs.com/package/homebridge-config-ui-x). Below those versions, Homebridge logs one warning at start.

The Homebridge host reaches Open-Meteo over HTTPS once an hour for the forecast, and once for each search on the settings page.

Until its settings hold a location, the plugin starts nothing, and [Finding Your Place](./place.md) takes you through setting one.
