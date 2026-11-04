# The Location

The plugin keeps your place as `latitude` and `longitude`, the two keys it needs before it starts anything, and each takes degrees to two decimals, about a kilometer, so each forecast request sends no more than that. [Finding Your Place](../install/place.md) fills them from a search on the settings page, and typing coordinates there stores them directly.

`place` holds the name, the region, and the country you confirmed, so the settings page can show which place the coordinates came from, and the estimate never reads it.

The plugin registers the same *Outside* accessory wherever the location moves, so its room and its automations in the Home app stay in place.
