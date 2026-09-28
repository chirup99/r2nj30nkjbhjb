---
name: Node dependency setup
description: Environment behavior to account for when installing dependencies in imported Node projects.
---

When using the Replit Node package installer with semver ranges, it may resolve newer versions and rewrite both package.json and package-lock.json instead of preserving the imported dependency declarations.

**Why:** A preview setup should avoid unrequested dependency upgrades and keep the imported project reproducible.

**How to apply:** After installing dependencies solely to run an imported project, inspect git diff and restore manifest/lockfile changes unless the user explicitly asked to upgrade packages.

The package installer does not accept an empty package list or npm CLI flags as a way to install an existing project; use the lockfile-native install path when dependencies are missing and no package change is requested.

**Why:** Imported projects need their declared dependency graph installed without treating installer options as package names or changing the manifests.

**How to apply:** Preserve package.json and package-lock.json, then use the repository's lockfile-aware package-manager command only when the package helper cannot express an install-only operation.