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

- **`npm run clean`** - Remove dependencies and build artefacts
- **`npm run prime`** - Install dependencies from the lockfile
- **`npm run setup`** - Install dependencies and link sibling `@metreeca/*` repositories
- **`npm run build`** - Compile sources and generate docs
- **`npm run check`** - Run the test suite
- **`npm run proof`** - Build and serve docs

> [!CAUTION]
> **`prime` and `setup` are not interchangeable.** Run `prime` when finalising a public release: `@metreeca/*` imports
> resolve to the published releases recorded in the lockfile. Run `setup` for local development against unpublished
> sibling branches: imports resolve to the working copies in the neighbouring repositories.

# Package Layout

The root `package.json` `workspaces` glob (`packages/*/*`) covers the connector packages, each nested under its
query-language group directory (for example `packages/sparql/wire-sparql`).

# Documentation

Readers are expected to know the query language each connector family exposes (SPARQL 1.1, SQL:2011, GQL:2024).
Document what a builder or connector adds on top of the language: how arguments are rendered, how empty fragments
and arrays are handled, what is validated or escaped and what is thrown. Never restate the semantics of the language
itself (what a keyword matches, what a function returns, how an aggregate groups): link the specification with `@see`
instead, and never explain self-evident naming choices such as respellings of reserved words.

# Testing

The root `vitest.config.ts` resolves imports of symlinked `@metreeca/*` packages, both workspace packages and siblings
linked by `npm run setup`, to the TypeScript source their `@metreeca/source` export entries declare, so tests run
against `src/` without a prior build. Packages installed from the registry keep resolving to their published `dist`.
An export entry lacking the condition falls back to `dist` as well, and tests then see that package as last built.

> [!CAUTION]
> **NEVER** enable `@metreeca/source` through vitest `resolve.conditions`. Published manifests carry the condition
> while their packages ship no `src/`, and Vite does not fall back to `default` on a missing target, so a global
> condition breaks every package installed from the registry that declares it, as happens under `npm ci` in CI.

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
