# Settings

What can I change, and what does each setting do? This section lists every setting the platform block takes, what each one does, and what happens without it.

- [The Location](./location.md) says how the plugin keeps your place.
- [The Threshold Levels](./thresholds.md) says what each threshold value means.

[Sensors](../sensors/) comes before this section with how each sensor switches at the levels set here.

## Settings Reference

Each key comes from `config.schema.json`, so this reference follows the schema as it changes.

<!-- settings-table -->

| **Key** | **Title** | **Type** | **Default** | **What It Does** | **Without It** |
|---|---|---|---|---|---|
| `latitude` | Latitude | number | None | Degrees north of the equator, negative to the south | Needed, and without it, the plugin starts nothing and logs the setting it lacks |
| `longitude` | Longitude | number | None | Degrees east of the prime meridian, negative to the west | Needed, and without it, the plugin starts nothing and logs the setting it lacks |
| `name` | Name | string | None | The name Homebridge sets in brackets before each line the plugin logs | Optional, and without it, Homebridge logs under the platform’s name |
| `place` | Place | object | None | The name, region, and country of the place whose coordinates the user confirmed | Optional, and without it, the coordinates stand alone, as they do once typed in by hand |
| `platform` | Not in the form | string | "Luxout" | The platform the block belongs to, which Homebridge reads to hand the block to the plugin | Needed, and without it, Homebridge skips the block |
| `thresholds` | Threshold Sensors | array | None | Sensors that each switch on as the light outdoors reaches one level and off only once it passes another, holding their state across the gap between the two | Optional, and without it, the plugin adds no threshold sensor |
| `thresholds[].name` | Name | string | None | The name the sensor takes in the Home app, where a new name adds a new sensor in place of the old one. It is at least two characters long, starts and ends on a letter or a number, and holds only letters, numbers, spaces, apostrophes, and & ! . _ : ; ( ) / , - | Needed, and without it, the entry starts no sensor and logs one line |
| `thresholds[].offLux` | Off Level | number | 662 | The reading in lux past which the sensor switches off | Optional, and without it, the sensor switches off past 662 lux |
| `thresholds[].onLux` | On Level | number | 2.99 | The reading in lux at which the sensor switches on. A level below the off level switches it on as the light falls, and one above it as the light rises | Optional, and without it, the sensor switches on at 2.99 lux |

<!-- /settings-table -->

## The Whole Block

The platform block in `config.json` with each key set reads as follows.

<!-- settings-block -->

```json
{
  "platform": "Luxout",
  "latitude": 42.36,
  "longitude": -71.06,
  "place": {
    "country": "United States",
    "name": "Boston",
    "region": "Massachusetts"
  },
  "name": "Luxout",
  "thresholds": [
    {
      "name": "Dark Outside",
      "offLux": 662,
      "onLux": 2.99
    }
  ]
}
```

<!-- /settings-block -->
