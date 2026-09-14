---
'@kurotako/cli': minor
---

Add a background version check against the `kurotako` npm package: `runCli()`
now accepts an optional `{ currentVersion }` and prints a one-line notice when
a newer version is available, refreshing an 8h-TTL cache (`~/.cache/tako/version-check.json`)
in the background without adding latency. Add the `tako outdated` command,
which reports the installed vs. latest version of every `@kurotako/*`
dependency in the current project.
