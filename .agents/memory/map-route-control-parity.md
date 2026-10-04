---
name: Map route control parity
description: Consistency rule for extending map-bar route interactions between cities.
---

When adding a route flow for another city, carry over the established control-to-route interaction as a whole: the clicked sub-button anchors the route, the route animates toward the matching map pin, and selecting the route target remains separate from selecting a pin to open its detail sheet.

**Why:** Matching only the curve geometry did not match the user's expected Hyderabad Magic Bar behavior; the anchor, progress animation, and click action were part of the interaction.

**How to apply:** Before extending a map route to another city, compare the full button, state, anchor, and route-progress behavior with the working city implementation.