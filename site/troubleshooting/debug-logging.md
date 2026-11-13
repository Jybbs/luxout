# Debug Logging

Each minute, the plugin logs a line at debug level naming the reading and the three figures it comes from. Homebridge prints that line only while debug logging is on, and it can be turned on for *Luxout* alone or for all of Homebridge.

## For *Luxout* Alone

Under Homebridge 2, run *Luxout* on a [child bridge](https://github.com/homebridge/homebridge/wiki/Child-Bridges) and turn on its Debug Mode setting, which writes `debugModeEnabled` in the platform block's `_bridge`, one of the settings a [`BridgeConfiguration`](https://developers.homebridge.io/homebridge/interfaces/BridgeConfiguration.html) takes. The child bridge then logs at debug level while the main bridge does not.

```json
{
  "platform": "Luxout",
  "_bridge": {
    "username": "0E:3C:95:2A:7B:41",
    "port": 51920,
    "debugModeEnabled": true
  }
}
```

## For All of Homebridge

Start Homebridge with `-D`, the flag `homebridge` takes for debug-level logging, which turns it on for every plugin at once. Under Homebridge 1, this is the only route.
