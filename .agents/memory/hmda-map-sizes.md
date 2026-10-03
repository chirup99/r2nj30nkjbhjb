---
name: HMDA source map sizes
description: External HMDA plan-sheet JPEGs can exceed ordinary image-optimizer pixel limits.
---

At least one official HUDA zone sheet is about 33.5 MB and 19,134 × 10,275 pixels (about 196.6 megapixels). Other sheets may differ in decoded size even when their compressed byte size looks similar.

**Why:** A 150-megapixel processing limit caused an official sheet to fail even though the source itself was available.

**How to apply:** Keep preview processing limits high enough for the largest source sheets, validate representative maps from both HMDA series, and preserve links to original full-resolution images for detailed reading.