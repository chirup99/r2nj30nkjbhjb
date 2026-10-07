---
name: Vite dependency cache
description: Recover a blank Vite preview caused by an outdated optimized dependency cache after reinstalling packages.
---

When installed package versions change and are then restored from the original lockfile, Vite may continue serving a stale dependency-optimizer cache. The server can report ready while the browser shows a blank page and `504 (Outdated Optimize Dep)` errors.

**Why:** The optimizer output can survive a package reinstall even though `node_modules` now contains a different dependency graph.

**How to apply:** Remove the generated `node_modules/.vite` cache and restart the existing app workflow, then verify the rendered page.
