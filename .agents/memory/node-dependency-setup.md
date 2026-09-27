---
name: Node dependency setup
description: Environment behavior to account for when installing dependencies in imported Node projects.
---

When using the Replit Node package installer with semver ranges, it may resolve newer versions and rewrite both package.json and package-lock.json instead of preserving the imported dependency declarations.

**Why:** A preview setup should avoid unrequested dependency upgrades and keep the imported project reproducible.

**How to apply:** After installing dependencies solely to run an imported project, inspect git diff and restore manifest/lockfile changes unless the user explicitly asked to upgrade packages.