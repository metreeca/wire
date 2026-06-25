# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased](https://github.com/metreeca/wire/compare/v0.9.0...HEAD)

### Added

- `@metreeca/wire-sparql` — `RepositoryClient` interface grouping the `ask`/`select`/`construct`/`update` query and
  update operations
- `@metreeca/wire-sparql` — `createBufferingRepository` and `createLoggingRepository` wrappers, coalescing a
  transaction's updates into a single request and logging each operation's elapsed time respectively

### Changed

- `@metreeca/wire-sparql` — `Repository` now extends `RepositoryClient`, and `Repository.execute` hands the task a
  `RepositoryClient` instead of a full `Repository`

### Removed

- `@metreeca/wire-sparql` — `rdf` and `xsd` namespace exports; the `xsd` datatype namespace is now sourced from
  `@metreeca/core`

## [0.9.0](https://github.com/metreeca/wire/releases/tag/v0.9.0)

### Added

- `@metreeca/wire-sparql` — SPARQL connector framework with `Repository` interface, N-Triples codec, RDF DSL,
  and SPARQL query/update combinators
- `@metreeca/wire-sparql-http` — SPARQL 1.1 Protocol endpoint connector
- `@metreeca/wire-sparql-oxigraph` — Oxigraph in-memory WASM store connector
- `@metreeca/wire-sparql-rdf4j` — RDF4J REST API endpoint connector with server-managed transaction support
