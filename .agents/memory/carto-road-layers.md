---
name: Carto named road geometry
description: Carto vector-tile layer and attributes needed to target named Hyderabad roads.
---

Named road geometry in the Carto streets vector source is exposed through the `transportation_name` source layer rather than the base `transportation` layer. Hyderabad Outer Ring Road features use `name`/`name_en` of `Outer Ring Road` and `ref` of `ORR`.

**Why:** The base transportation layer omits road-name attributes, so filtering it by a road name silently renders nothing or requires inaccurate hand-drawn geometry.

**How to apply:** When highlighting a named Carto road, add a line layer over `transportation_name` and filter by the exact name or road reference. Keep the label layer above the highlight when possible.