# Reading the Debug Line

The debug line names the reading Apple Home shows and the three figures it comes from, the sun's altitude, the clear-sky illuminance at that altitude, and the cloud factor, beside the two forecast steps the factor falls between. A figure that looks wrong points at the page that explains it, [the sun's altitude](../estimate/altitude.md), [the clear-sky curve](../estimate/clear-sky.md), or [the cloud factor](../estimate/cloud-factor.md). Where no stored window covers the minute, the cloud factor is 1 and the line ends on *"since no forecast covers the minute"* in place of the two steps.

## The Fields

<!-- line-fields -->

| **Field** | **In the Sample Line** | **What It Holds** |
|---|---|---|
| Time | `10/4/2026, 10:00:00 AM` | The time on the bridge’s clock, in its locale’s format. |
| Name | `Luxout` | The platform block’s name, or the platform name the plugin registers where it sets none. |
| Sensor | `Outside` | The light sensor the reading is for, as the plugin names it. |
| Reading | `48680 lux` | The lux Apple Home shows, held between 0.0001 and 100000. |
| Altitude | `31.72°` | The sun’s angle above the horizon, before refraction. |
| Clear sky | `54820 lux` | The lux of a cloudless sky at this altitude, per U.S. Naval Observatory Circular 171. |
| Cloud factor | `0.888` | The forecast’s share of clear-sky sunlight at the ground. |
| Forecast steps | `0.9435 at 2026-10-04T13:45:00.000Z and 0.888 at 2026-10-04T14:00:00.000Z` | The two 15-minute steps the factor falls between, each at its time in UTC. |

<!-- /line-fields -->
