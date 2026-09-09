---
"@kurotako/core": patch
---

Generated namespace root barrels now resolve overlapping public generator exports deterministically, so package declaration builds remain valid. The lexically first generator owns a colliding root export; every generator-specific subpath remains available.
