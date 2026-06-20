> [!CAUTION]
>
> - **ONLY** modify code when explicitly requested or clearly required.
> - **NEVER** make unsolicited changes or revert **unrelated** user edits.
> - **ALWAYS** monitor IDE diagnostics when working on a file

> [!CAUTION]
> Activating and following skill guidance is **MANDATORY** for every task. Before starting any work, identify and
> activate all relevant skills. Skill instructions are binding and override default behaviours. When in doubt about
> whether skill guidance is current, relevant skills MUST be reloaded.

# Overview

`@metreeca/wire` is a standalone, general-purpose monorepo collecting database storage connectors as leaf packages
grouped by query-language family under `packages/<group>/` (for example `packages/sparql/`), spanning the SPARQL 1.1,
SQL:2011, and GQL:2024 / openCypher query-language families.

Each connector exposes its backend through a common per-family query API (the SPARQL `Repository` interface for now);
there is no intermediate core package. The connectors are self-contained and consumer-agnostic.

# References

- [@metreeca/core](https://github.com/metreeca/core) - Core utilities and shared types

# NPM Scripts

- **`npm run clean`** - Remove build artifacts and dependencies (dist, docs, node_modules)
- **`npm run setup`** - Install dependencies
- **`npm run build`** - Build TypeScript and generate TypeDoc documentation
- **`npm run check`** - Run Vitest test suite
- **`npm run proof`** - Build documentation and start static server

# Package Layout

The root `package.json` `workspaces` glob (`packages/*/*`) covers the connector packages, each nested under its
query-language group directory (for example `packages/sparql/wire-sparql`).

# Testing

The root `vitest.config.ts` aliases all workspace `@metreeca/wire*` packages to their TypeScript source via regex, so
vitest transpiles directly from `src/` without requiring a prior build step. The resolver discovers each
`@metreeca/wire*` specifier's group directory by scanning the subdirectories of `packages/`, mapping it to
`packages/<group>/<package>/src`; the aliases are convention-based and require no manual updates when adding packages,
groups, or subpath exports.

# Git

This is a single monorepo: every package lives under `packages/` within one repository. Contrary to the general "avoid
`git -C`" guidance in the global tool rules and the `version-manager` skill's Git Command Rules, `git -C <package-path>`
is **perfectly acceptable** here and preferred for scoping a command to a package subtree, since it lets commands be
pre-authorised in bulk. This override applies to `git -C` only; the other Git Command Rules (no command chaining, stage
files by name) still hold.

# Version Management

All workspace packages share the same version, defined in the root `package.json` `version` field. When bumping the
version, cascade the change to all `packages/**/package.json` — both the package `version` field and any internal
`@metreeca/wire*` dependency ranges.

When adding, removing, or renaming packages, update the package table in the root `README.md` Usage section to match.

# Documentation Synchronization

For each package, the following descriptions must be kept in sync:

- `package.json`: `description` field
- `README.md`: first paragraph after badges
- module doc definition line
- GitHub repository "About" section (when publishing)
