# The Limits of the Estimate

The reading is the model's estimate of how bright it should be at your place right now, never a measurement. Under a clear sky, the curve alone sets the reading and the forecast reports a cloud factor near 1, so the limits below come from clouds, from where you stand, from the night, and from the forecast itself.

## Under Broken Clouds

The forecast can place a cloud in the wrong spot or the wrong quarter-hour, and the reading can then run several times too high or too low until the next step. [The gap a threshold sensor holds](../sensors/thresholds.md#the-gap) keeps that error from switching an automation back and forth.

## At Your Own Spot

Shade, buildings, and which way a window faces lie outside any forecast, so the reading describes open, level ground at your place.

## At Night

<!-- night-limit -->

Moonlight and light pollution sit outside the model. A clear full moon gives 0.05 to 0.3 lux, per the [Illuminance table of Wikipedia's Lux article](https://en.wikipedia.org/wiki/Lux#Illuminance), while the reading falls toward [HomeKit's floor](https://developers.homebridge.io/#/characteristic/CurrentAmbientLightLevel) of 0.0001 lux after astronomical twilight.

<!-- /night-limit -->

## An Interpolated Forecast

[Open-Meteo](https://open-meteo.com/en/docs) holds 15-minute forecasts of its own only over North America and Central Europe, and every other region's 15-minute values are interpolated from hourly ones, per its [GFS and RRFS documentation](https://open-meteo.com/en/docs/gfs-api). Under an interpolated forecast, a cloud that passes between two hourly values does not change the cloud factor, so the reading follows the clouds less closely there.
