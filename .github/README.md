<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://luxout.fyi/logo/title-dark.svg">
  <img alt="luxout" src="https://luxout.fyi/logo/title-light.svg" width="320">
</picture>

*An outdoor light sensor for Apple Home.*

[![npm](https://luxout.fyi/badges/npm.svg)![The latest version on npm](https://img.shields.io/npm/v/homebridge-luxout?style=for-the-badge&label=&color=e8c840)](https://www.npmjs.com/package/homebridge-luxout)
[![node](https://luxout.fyi/badges/node.svg)![The Node versions the plugin runs on](https://img.shields.io/node/v/homebridge-luxout?style=for-the-badge&label=&color=e8c840)](https://luxout.fyi/install/installing)
[![docs](https://luxout.fyi/badges/docs.svg)![The docs site](https://img.shields.io/badge/luxout.fyi-e8c840?style=for-the-badge)](https://luxout.fyi)

*Luxout* is a [Homebridge](https://homebridge.io) plugin that estimates how bright it is outdoors at your place and shows the reading in Apple Home as a light sensor, with no hardware, so a Home automation can dim the lights once it is dark out. The reading comes from the sun's position and the forecast of sunlight at the ground.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://luxout.fyi/readme/day-estimate-dark.gif">
  <img alt="The Day Estimate dial sweeping once around the sample day in Boston in a frame that takes the sky's color at each minute, from the night's blue through the twilight's rose to the gold of the day, the clock and the stretch of twilight set large on either side." src="https://luxout.fyi/readme/day-estimate-light.gif" width="100%">
</picture>

[Weather data by Open-Meteo.com](https://open-meteo.com/), offered under [Attribution 4.0 International (CC BY 4.0)](https://open-meteo.com/en/licence).

## 📗 Where to Start

<p align="center">
  <a href="https://luxout.fyi/estimate/"><picture><source media="(prefers-color-scheme: dark)" srcset="https://luxout.fyi/readme/understand-dark.svg"><img alt="Understand: Estimate" src="https://luxout.fyi/readme/understand-light.svg" width="260"></picture></a>
  <a href="https://luxout.fyi/troubleshooting/"><picture><source media="(prefers-color-scheme: dark)" srcset="https://luxout.fyi/readme/check-dark.svg"><img alt="Check: Troubleshooting" src="https://luxout.fyi/readme/check-light.svg" width="260"></picture></a>
  <a href="https://luxout.fyi/install/installing"><picture><source media="(prefers-color-scheme: dark)" srcset="https://luxout.fyi/readme/run-dark.svg"><img alt="Run: Installing Luxout" src="https://luxout.fyi/readme/run-light.svg" width="260"></picture></a>
</p>

[luxout.fyi](https://luxout.fyi) also covers:

- [The *Outside* sensor](https://luxout.fyi/sensors/outside) and [the threshold sensors](https://luxout.fyi/sensors/thresholds), with [the gap](https://luxout.fyi/sensors/thresholds#the-gap) between each one's on and off levels
- [The location](https://luxout.fyi/settings/location) and [the threshold levels](https://luxout.fyi/settings/thresholds) the settings take
- [What the plugin sends](https://luxout.fyi/privacy/sends) and [the rounded place](https://luxout.fyi/privacy/sends#the-place-each-request-carries) it stores
- [Building an automation](https://luxout.fyi/sensors/thresholds#automations) on a threshold sensor in the Home app
