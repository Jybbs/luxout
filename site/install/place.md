# Finding Your Place

The settings page turns a zip code or a city into the place the plugin stores, so you set your location once without looking up its coordinates. [The Location](../settings/location.md) covers what each of the stored keys does.

## Searching for a Zip Code

A search for one zip code runs through these stages, from opening the settings to the saved block in `config.json`.

<!-- search-stages -->

| **Stage** | **The Settings Page** | **What Crosses** |
|---|---|---|
| Open | The search field empty and no place kept | Nothing sent. The page reads the platform block, empty until the plugin is configured, and sends no search until you ask for one. |
| Type | The zip code `02115` in the search field | Nothing sent. The page reads the platform block, empty until the plugin is configured, and sends no search until you ask for one. |
| Search | The spinner over the page | The search the server script sends. `GET /v1/search?count=10&language=en&name=02115 Host: geocoding-api.open-meteo.com`. It leaves from the Homebridge host rather than from the browser. |
| Match | Boston, Massachusetts, United States under Matches | The fields the server script reads. `{ "name": "Boston", "latitude": 42.35843, "longitude": -71.05977, "admin1": "Massachusetts", "country": "United States" }`. It reads 5 of the 18 fields in the recorded result and rounds the coordinates to two decimals. |
| Confirm | The latitude, the longitude, and the place kept beside the search | The block passed to the Homebridge UI. `{ "platform": "Luxout", "latitude": 42.36, "longitude": -71.06, "place": { "country": "United States", "name": "Boston", "region": "Massachusetts" } }`. Nothing is written yet, so closing the settings without Save leaves `config.json` as it was. |
| Save | Save pressed | The block in `config.json`. `{ "platform": "Luxout", "latitude": 42.36, "longitude": -71.06, "place": { "country": "United States", "name": "Boston", "region": "Massachusetts" } }` |

<!-- /search-stages -->
