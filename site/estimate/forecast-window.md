# The Forecast Window

A forecast window is what one fetch brings back and the plugin stores, the forecast of sunlight at the ground at your place in steps of 15 minutes. Each minute's reading uses the window the plugin holds and sends no request, and one fetch an hour replaces it.

## One Request

<!-- window-request -->

Each fetch sends one request to [Open-Meteo's forecast API](https://open-meteo.com/en/docs) for `shortwave_radiation_instant` under `minutely_15`, covering 4 steps before the current step and 24 counted from it, so the window starts 1 hour back and its last step starts 5 hours and 45 minutes ahead.

<!-- /window-request -->

The plugin fetches once an hour, at a minute and a second drawn at random when [Homebridge](https://homebridge.io) starts, which spreads each install's request across the hour.

## The Stored File

The plugin writes each new window whole to one file in the Homebridge storage directory, beside the coordinates it was fetched for. When Homebridge starts, the plugin reads that file and sends no request while the window covers the present through the first hourly fetch. A window fetched for other coordinates counts as no window.

## The Sample Window

<!-- window-sample -->

The sample day these pages draw holds one window, 28 steps from 06:15 to 13:00 on October 4, fetched for the zip code [Finding Your Place](../install/place.md) searches for. Its minutes outside that span read the clear sky alone.

<!-- /window-sample -->
