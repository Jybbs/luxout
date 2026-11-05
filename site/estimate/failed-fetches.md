# While Fetches Fail

A failed fetch leaves the reading running on what the plugin already holds. A failed connection, a timeout, an error status from [Open-Meteo](https://open-meteo.com/en/docs), and an answer that fails validation each count as a failure, and the plugin logs each one once and keeps running.

## Retries

<!-- fetch-retry -->

The plugin retries 1 minute after a failed fetch and doubles the wait each time, scheduling no retry at or past the next hourly fetch, so a failing hour sends at most 6 requests. A request with no answer after 10 seconds times out.

<!-- /fetch-retry -->

## The Stored Window

The reading keeps using the [stored window](./forecast-window.md) from one fetch to the next, each minute still taking the cloud factor between the two steps around it.

<!-- fetch-reach -->

A window's last step starts 5 hours and 45 minutes after the step its fetch falls in, which carries the reading through 5 failed hourly fetches in a row.

<!-- /fetch-reach -->

## The Clear Sky Alone

Once no stored window covers the present, the cloud factor is 1, so the reading is [the clear-sky curve](./clear-sky.md) alone. The next fetch to succeed restores the cloud factor.

## Lines in the Log

| **Line** | **What Happened** |
|---|---|
| `Open-Meteo could not be reached` | The request found no connection to Open-Meteo |
| `Open-Meteo sent no answer before the request timed out` | The request reached its time limit |
| `Open-Meteo answered with an error` | The answer carried an error status |
| `Open-Meteo sent an answer that fails validation` | The answer held no forecast the plugin could read |
| `Outside reads the clear sky alone until a forecast covers the present` | No stored window covers the present minute |
