<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://luxout.fyi/logo/lockup-dark.svg">
    <img alt="Luxout. An outdoor light sensor for Apple Home." src="https://luxout.fyi/logo/lockup-light.svg" width="560">
  </picture>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/homebridge-luxout"><img alt="npm" src="https://luxout.fyi/badges/npm.svg"><img alt="The latest version on npm" src="https://img.shields.io/npm/v/homebridge-luxout?style=for-the-badge&label=&color=e8c840"></a>
  <a href="https://luxout.fyi/install/installing"><img alt="node" src="https://luxout.fyi/badges/node.svg"><img alt="The Node LTS lines the plugin runs on, from 22" src="https://img.shields.io/badge/LTS%2022%2B-e8c840?style=for-the-badge"></a>
  <a href="https://luxout.fyi"><img alt="docs" src="https://luxout.fyi/badges/docs.svg"><img alt="The docs site" src="https://img.shields.io/badge/luxout.fyi-e8c840?style=for-the-badge"></a>
</p>

*Luxout* is a [Homebridge](https://homebridge.io) plugin that estimates how bright it is outdoors at your place and shows the reading in Apple Home as a light sensor, with no hardware, so a Home automation can dim the lights once it is dark out. The reading comes from the sun's position and the forecast of sunlight at the ground.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://luxout.fyi/readme/day-estimate-dark.gif">
  <img alt="The Day Estimate dial sweeping once around the sample day in Boston in a frame that takes the sky's color at each minute, from the night's blue through the twilight's rose to the gold of the day, the clock and the stretch of twilight set large on either side." src="https://luxout.fyi/readme/day-estimate-light.gif" width="100%">
</picture>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://luxout.fyi/readme/credit-dark.svg">
    <img alt="Credits. The forecast behind every reading, and the terms it is shared under. Weather data by Open-Meteo.com, Patrick Zippenfenig, Zenodo, 2024, CC BY 4.0." src="https://luxout.fyi/readme/credit-light.svg" width="296">
  </picture>
</p>

<p align="center">
  <code>DATA</code>&nbsp;<a href="https://open-meteo.com/">Weather data by Open-Meteo.com</a><br>
  <code>DOI</code>&nbsp;<a href="https://doi.org/10.5281/zenodo.7970649">10.5281/zenodo.7970649</a><br>
  <code>CREATORS</code>&nbsp;Patrick Zippenfenig<br>
  <code>PUBLISHED</code>&nbsp;Zenodo, 2024<br>
  <code>LICENSE</code>&nbsp;<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a><br>
  <code>CHANGED</code>&nbsp;<code>shortwave_radiation_instant</code> ÷ clear sky
</p>

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
