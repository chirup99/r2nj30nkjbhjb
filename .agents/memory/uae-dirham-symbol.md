---
name: UAE dirham symbol rendering
description: The official map currency sign is a capital D crossed by two horizontal bars and needs a font-independent rendering.
---

On this project’s property map, display the official UAE dirham sign as a D crossed by two horizontal bars. Do not rely on U+20C3 as a visible glyph: the available runtime fonts do not include it. Use the official shape as a colorable vector mask, and replace the internal U+20C3 marker when rendering formatted AED prices.

**Why:** The user pointed to the UAE government’s official currency page and corrected the first implementation because it did not visibly show the D with two lines.

**How to apply:** Keep the currency selector, project prices, detail sheets, and price filters on the same font-independent sign renderer.