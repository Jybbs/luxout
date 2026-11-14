# Luxout

*An outdoor light sensor for Apple Home.*

## Light Reading

One lamp to each section, from Install to Troubleshooting.

<!-- front-lamps -->

| **Section** | **Question** | **Opens On** |
|---|---|---|
| Install | How do I install Luxout and point it at my place? | [install/index.md](./install/index.md) |
| Sensors | What does Luxout add to Apple Home, and what does each sensor read? | [sensors/index.md](./sensors/index.md) |
| Settings | What can I change, and what does each setting do? | [settings/index.md](./settings/index.md) |
| Estimate | Where does the reading come from, and where does it stop? | [estimate/index.md](./estimate/index.md) |
| Privacy | What does Luxout send, and what does it keep? | [privacy/index.md](./privacy/index.md) |
| Troubleshooting | What do I do when a reading looks wrong? | [troubleshooting/index.md](./troubleshooting/index.md) |

<!-- /front-lamps -->

## Where the Reading Comes From

The estimate rests on these sources, each credited under its own terms.

<!-- front-sources -->

| **Source** | **Supplies** | **Terms** |
|---|---|---|
| [Open-Meteo](https://open-meteo.com/en/docs) | The forecast. Sunlight at the ground every 15 minutes, six hours ahead, fetched once an hour. | Data CC BY 4.0 |
| [GeoNames](https://www.geonames.org/) | The place. The town a zip code or a city resolves to, through Open-Meteo’s geocoding API. | Data CC BY 4.0 |
| [astronomy-engine](https://www.npmjs.com/package/astronomy-engine) | The sun’s position. The sun’s altitude at the stored place, computed every minute on the bridge. | MIT License |
| [Circular 171](https://archive.org/details/DTIC_ADA182110) | The clear-sky curve. The U.S. Naval Observatory’s lux from the sun and sky, through day and twilight alike. | U.S. Government work |
| [Haurwitz](https://doi.org/10.2172/1039404) | The clear-sky irradiance. The clear sky’s W/m² the forecast is divided by, per Sandia report SAND2012-2389. | U.S. Department of Energy report |

<!-- /front-sources -->
