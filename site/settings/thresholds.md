# The Threshold Levels

Each entry under `thresholds` adds one sensor, and [Threshold Sensors](../sensors/thresholds.md) covers how it switches.

- `name` is the name the sensor takes in the Home app, so a new name adds a new sensor in place of the old one.
- `onLux` is the reading at which the sensor switches on, and `offLux` the reading past which it switches off.
- The order of the two levels sets the sensor's direction, so an on level below the off level switches the sensor on as the light falls, and one above it as the light rises.

Two equal levels leave no gap, so that entry starts no sensor and logs one line naming it, as does an entry with no name. A level left out takes the figure the form shows as its placeholder.
