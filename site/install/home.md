# The *Outside* Sensor in Home

Once [Homebridge](https://homebridge.io) restarts with the saved block, the plugin registers one accessory named *Outside*, a light sensor that appears in the Home app beside the bridge's other accessories. The sensor keeps that name, since a name changed after pairing does not reach iOS.

The first reading follows the first forecast request, which the plugin sends at once when no stored forecast covers the present, and *Outside* reads the clear sky alone until a request succeeds. It updates once a minute, and its figure in the Home app is the outdoor lux at the place you saved, which [The *Outside* Sensor](../sensors/outside.md) sets out.

Should *Outside* stay absent or show *"No Response"*, the Homebridge log names the setting at fault in a line reading `Outside reads nothing until the settings hold a valid` followed by that key.
