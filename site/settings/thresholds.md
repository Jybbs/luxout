# The Threshold Levels

Each entry under `thresholds` adds one sensor, and [Threshold Sensors](../sensors/thresholds.md) covers how it switches.

<!-- threshold-levels -->

- `name`, the Name field. The name the sensor takes in the Home app, where a new name adds a new sensor in place of the old one. It is at least two characters long, starts and ends on a letter or a number, and holds only letters, numbers, spaces, apostrophes, and & ! . _ : ; ( ) / , -.
- `offLux`, the Off Level field. The reading in lux past which the sensor switches off.
- `onLux`, the On Level field. The reading in lux at which the sensor switches on. A level below the off level switches it on as the light falls, and one above it as the light rises.

<!-- /threshold-levels -->

Two equal levels leave no gap, so that entry starts no sensor and logs one line naming it, as does an entry with no name. A level left out takes the figure the form shows as its placeholder.
