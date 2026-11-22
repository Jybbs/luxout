# Installing *Luxout*

`homebridge-luxout` is a plugin for [Homebridge](https://homebridge.io) that needs no hardware, no account, and no API key, since its reading comes from the sun's position and from [Open-Meteo](https://open-meteo.com/en/docs)'s forecast.

## Supported Versions

Version {{ $frontmatter.package.version }} runs on Homebridge <code>{{ $frontmatter.package.engines.homebridge }}</code> under [Node](https://nodejs.org) <code>{{ $frontmatter.package.engines.node }}</code>, and the plugin's settings page opens inside the [Homebridge UI](https://www.npmjs.com/package/homebridge-config-ui-x). Below those versions, Homebridge logs one warning at start.

The Homebridge host reaches Open-Meteo over HTTPS once an hour for the forecast, and once for each search on the settings page.

## Adding the Plugin

In the Homebridge UI, search the plugins for `homebridge-luxout` and install it. From a terminal, the command depends on how Homebridge itself was installed, as the Homebridge wiki's [How to Install Alternate Plugin Versions](https://github.com/homebridge/homebridge/wiki/How-to-Install-Alternate-Plugin-Versions) sets out.

On the Raspberry Pi image, the Debian or Ubuntu `apt` package, or the Synology package, [`hb-service`](https://github.com/homebridge/homebridge-config-ui-x/wiki/Homebridge-Service-Command) adds it:

```sh
sudo hb-service add homebridge-luxout
```

Where Homebridge was installed with `npm install -g`, as in a native install on macOS, [npm installs it globally](https://docs.npmjs.com/downloading-and-installing-packages-globally) beside Homebridge:

```sh
sudo npm install -g homebridge-luxout
```

Until its settings hold a location, the plugin starts nothing, and [Finding Your Place](./place.md) takes you through setting one.
