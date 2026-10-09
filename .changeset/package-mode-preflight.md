---
'@kurotako/core': patch
---

Mode `package`: the preflight check now reports every missing prerequisite in one error (workspace base files, `typescript`, and the peer dependencies of the active generators), and the root-barrel name clash message between generators is logged at debug level instead of as a warning.
