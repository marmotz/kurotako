#!/usr/bin/env bash
#
# Runs `changeset version` then re-syncs bun.lock, as a single command.
#
# Why this script instead of `bunx changeset version && bun install` inline in the
# workflow: changesets/action runs the `version` input without a shell, so `&&` is
# passed as a literal argument to `changeset version` instead of being interpreted
# as a shell operator, and the command fails with a CACError from cac's arg parser.
#
# `changeset version` only bumps package.json / CHANGELOG.md; it never touches
# bun.lock. Without the `bun install` here, bun.lock keeps recording the pre-bump
# internal versions, and `bun pm pack` resolves `workspace:^` from that stale
# lockfile at publish time (see the "fix-stale-ir-dependency-range" incident:
# parser-openapi@0.2.0/0.2.1 and gen-typescript@0.3.0/0.3.1 were all published with
# a stale `@kurotako/ir` range despite correct source).

set -euo pipefail

bunx changeset version
bun install
