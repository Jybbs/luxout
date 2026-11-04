# The *Outside* Sensor

*Outside* is a [Light Sensor](https://developers.homebridge.io/#/service/LightSensor) whose reading is the estimate of how bright it is outdoors at the place you saved, in lux. The plugin computes the sun's position each minute, reads the brightness of a clear sky at that position, and scales it by the share of sunlight the last [Open-Meteo](https://open-meteo.com/en/docs) forecast says the clouds let through.

The plugin writes that reading to [`CurrentAmbientLightLevel`](https://developers.homebridge.io/#/characteristic/CurrentAmbientLightLevel), clamped into the {{ $frontmatter.homekit.min }} to {{ $frontmatter.homekit.max }} lux that characteristic accepts. A moonless night therefore reads {{ $frontmatter.homekit.min }} rather than zero, and full sun at a high altitude holds at {{ $frontmatter.homekit.max }}.

## Nine Decades of Lux

<!-- lux-lede -->

Each decade is one tenfold step of lux, and on October 4, the reading spends hours in the darkest and brightest steps and only **22 to 31 minutes** in each step of twilight.

<!-- /lux-lede -->

<!-- lux-decades -->

| **Lux** | **Everyday Light** | **Clear Sky** | **October 4** |
|---|---|---|---|
| 0.0001 to 0.001 lux | Moonless, overcast night sky at 0.0001 | The sun from −15.5° to −13.4° | 608 minutes, until 05:37 and from 19:29 |
| 0.001 to 0.01 lux | Moonless clear night sky with airglow at 0.002 | The sun from −13.4° to −11.2°, nautical twilight ends at 0.00436 | 24 minutes, 05:37 to 05:49 and 19:17 to 19:29 |
| 0.01 to 0.1 lux | Quarter moon on a clear night at 0.01 | The sun from −11.2° to −9.1° | 22 minutes, 05:49 to 06:00 and 19:06 to 19:17 |
| 0.1 to 1 lux | Full moon on a clear night at 0.05 to 0.3 | The sun from −9.1° to −7.0° | 24 minutes, 06:00 to 06:12 and 18:54 to 19:06 |
| 1 to 10 lux | Dark limit of civil twilight under a clear sky at 3.4 | The sun from −7.0° to −4.8°, civil twilight ends at 2.99 | 24 minutes, 06:12 to 06:25 and 18:43 to 18:54 |
| 10 to 100 lux | Public areas with dark surroundings at 20 to 50, Family living room lights at 50, Office building hallway lighting at 80 | The sun from −4.8° to −2.6° | 24 minutes, 06:25 to 06:37 and 18:31 to 18:43 |
| 100 to 1,000 lux | Very dark overcast day at 100, Railway station platforms at 150, Office lighting at 320 to 500, Sunrise or sunset on a clear day at 400 | The sun from −2.6° to 0.0°, sunset at 662 | 31 minutes, 06:37 to 06:53 and 18:16 to 18:31 |
| 1,000 to 10,000 lux | Overcast day at 1,000 | The sun from 0.0° to 9.3° | 108 minutes, 06:53 to 07:50 and 17:25 to 18:16 |
| 10,000 to 100,000 lux | Full daylight, not direct sun at 10,000 to 25,000, Direct sunlight at 32,000 to 100,000 | The sun from 9.3° to 57.8°, sun at 10° at 11,231, sun at 30° at 51,321, solar noon on the sample day at 76,677, sun at 60° past the ceiling at 102,957 | 575 minutes, 07:50 to 17:25 |

<!-- /lux-decades -->

The everyday light comes from the Illuminance table of [Wikipedia's Lux article](https://en.wikipedia.org/wiki/Lux#Illuminance), and the clear sky from U.S. Naval Observatory Circular 171.[^janiczek1987] The sample day runs the plugin's own estimate at the zip code [Finding Your Place](../install/place.md) searches for.

## Using the Reading

The Home app can trigger an automation when a light sensor's reading passes a level, as [About iOS 15 Updates](https://support.apple.com/en-us/108051) describes. That automation can run again each time the reading moves back past the level, so a reading wavering around its level as clouds pass can run it again and again. [Threshold Sensors](./thresholds.md) exist to hold through those crossings.

[^janiczek1987]: Janiczek and DeYoung. 1987. "Computer Programs for Sun and Moon Illuminance With Contingent Tables and Diagrams." U.S. Naval Observatory, Circular 171. <https://archive.org/details/DTIC_ADA182110>
