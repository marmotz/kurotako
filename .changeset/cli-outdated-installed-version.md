---
'@kurotako/cli': patch
---

Fix `tako outdated` always reporting the installed version as `unknown`:
`resolveInstalledVersion` was resolving `<name>/package.json`, a subpath
blocked by each package's `exports` field. It now walks the same
`node_modules` lookup path Node uses and reads the package's `package.json`
directly.
