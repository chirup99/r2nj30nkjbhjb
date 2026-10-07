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

When Replit's package firewall blocks a vulnerable transitive version, do not bypass it. Verify the patched release and the parent package's semver range using authoritative package metadata. If the existing range admits the patch, update only the lockfile resolution and published integrity before retrying the install. A lockfile-only update can fail while trying to fetch an unrelated optional platform package; inspect the log to distinguish that from the blocked dependency.

**Why:** Imported lockfiles may pin releases that Replit's firewall now rejects, while the parent dependency already permits a safe patch. In one setup, lockfile-only resolution also attempted to fetch a Tailwind WASI optional artifact unrelated to the runtime platform.

**How to apply:** Keep the manifest unchanged when its declared range accepts the fix; use the patched tarball and official integrity, then run the lockfile install again. Never work around a security block by disabling the firewall.