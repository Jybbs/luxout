# The Cloud Factor

The cloud factor is the share of a clear sky's sunlight that reaches the ground, from 0 to 1, and the reading is the clear-sky curve times that share. Each fetch brings [Open-Meteo](https://open-meteo.com/en/docs)'s forecast of sunlight at the ground in steps of 15 minutes, and each minute takes the factor on the straight line between the two steps around it, so the reading moves every minute, with the sun and along that line.

## The Share the Clouds Let Through

Each 15-minute step divides the forecast's sunlight at the ground by a clear sky's, and the result is the share of a clear sky's light the clouds let through. The forecast's figure is `shortwave_radiation_instant`, the total sunlight on a horizontal surface at the step's time, in watts per square meter. A clear sky's figure comes from the Haurwitz clear-sky model, with the constants Reno, Hansen, and Stein give,[^reno2012] at the same refracted altitude [the clear-sky curve](./clear-sky.md) uses.

<!-- cloud-table -->

| **Step** | **The Forecast** | **A Clear Sky** | **Share** |
|---|---|---|---|
| 06:15 | 0.0 W/m² | 0.0 W/m² | 78%, borrowed |
| 06:30 | 0.0 W/m² | 0.0 W/m² | 78%, borrowed |
| 06:45 | 0.0 W/m² | 0.0 W/m² | 78%, borrowed |
| 07:00 | 0.0 W/m² | 10.2 W/m² | 78%, borrowed |
| 07:15 | 31.0 W/m² | 47.7 W/m² | 78%, borrowed |
| 07:30 | 69.7 W/m² | 93.2 W/m² | 75% |
| 07:45 | 108.3 W/m² | 140.7 W/m² | 77% |
| 08:00 | 149.3 W/m² | 188.4 W/m² | 79% |
| 08:15 | 195.2 W/m² | 235.5 W/m² | 83% |
| 08:30 | 245.0 W/m² | 281.5 W/m² | 87% |
| 08:45 | 295.4 W/m² | 326.0 W/m² | 91% |
| 09:00 | 333.9 W/m² | 368.8 W/m² | 91% |
| 09:15 | 377.5 W/m² | 409.6 W/m² | 92% |
| 09:30 | 399.3 W/m² | 448.3 W/m² | 89% |
| 09:45 | 457.3 W/m² | 484.7 W/m² | 94% |
| 10:00 | 460.4 W/m² | 518.5 W/m² | 89% |
| 10:15 | 516.1 W/m² | 549.6 W/m² | 94% |
| 10:30 | 536.8 W/m² | 577.9 W/m² | 93% |
| 10:45 | 595.2 W/m² | 603.3 W/m² | 99% |
| 11:00 | 608.7 W/m² | 625.5 W/m² | 97% |
| 11:15 | 617.2 W/m² | 644.7 W/m² | 96% |
| 11:30 | 655.0 W/m² | 660.6 W/m² | 99% |
| 11:45 | 676.6 W/m² | 673.1 W/m² | 100% |
| 12:00 | 656.9 W/m² | 682.3 W/m² | 96% |
| 12:15 | 682.4 W/m² | 688.1 W/m² | 99% |
| 12:30 | 634.8 W/m² | 690.4 W/m² | 92% |
| 12:45 | 656.3 W/m² | 689.3 W/m² | 95% |
| 13:00 | 677.7 W/m² | 684.7 W/m² | 99% |

<!-- /cloud-table -->

## A Low Sun

<!-- cloud-floor -->

The ratio means little while the sun sits low, where both figures run close to zero. A step whose sun stands below 5° once refracted takes the mean factor of the 4 nearest daylight steps, those at 5° or above, from 12 hours before it to 4 hours after it, and 1 where none lies in that span, as on a high-latitude winter day whose sun never reaches 5°.

<!-- /cloud-floor -->

## The Ceiling

The share holds at 1, so the clear-sky curve is the ceiling, and a cloud's bright edge never reads above a clear sky.

[^reno2012]: Reno, Hansen, and Stein. 2012. "Global Horizontal Irradiance Clear Sky Models: Implementation and Analysis." Sandia National Laboratories, SAND2012-2389. <https://doi.org/10.2172/1039404>
