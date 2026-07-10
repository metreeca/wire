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
- `@metreeca/wire-sparql` — `./dsl` query and update combinators: `ask`, `select`, `all`, `where`, `insert`, `deleet`,
  and `update`
- `@metreeca/wire-sparql` — `./dsl` expression combinators for the SPARQL built-in function library: arithmetic
  operators (`add`, `sub`, `mul`, `div`), the `isNotIn` membership test, RDF term constructors (`iri`, `bnode`,
  `strdt`, `strlang`, `uuid`, `struuid`), string functions (`strlen`, `substr`, `ucase`, `lcase`, `strstarts`,
  `strends`, `contains`, `strbefore`, `strafter`, `encodeForUri`, `concat`, `regex`, `replace`), numeric functions
  (`abs`, `round`, `ceil`, `floor`, `rand`), temporal functions (`now`, `year`, `month`, `day`, `hours`, `minutes`,
  `seconds`, `timezone`, `tz`), and hash functions (`md5`, `sha1`, `sha256`, `sha384`, `sha512`)

### Changed

- `@metreeca/wire-sparql` — `Repository` now extends `RepositoryClient`, and `Repository.execute` hands the task a
  `RepositoryClient` instead of a full `Repository`
- `@metreeca/wire-sparql` — renamed the `./dsl` `alias` projection combinator to `as`
- `@metreeca/wire-sparql` — `./dsl` variadic combinators now drop empty operands (such as those produced by `nil`)
  before joining, so optional operands left out introduce no redundant separators
- `@metreeca/wire-sparql` — `./dsl` group and block pattern combinators (`where`, `group`, `optional`, `minus`,
  `graph`, `service`, `exists`, `nexists`) and the `groupBy`, `orderBy`, and `having` clause modifiers now drop empty
  clauses and yield the empty fragment when none survive; `limit` and `offset` yield the empty fragment for a count of
  `0`, and `having` accepts a list of conditions bracketed and conjoined with `&&`

### Removed

- `@metreeca/wire-sparql` — `rdf` and `xsd` namespace exports; the `xsd` datatype namespace is now sourced from
  `@metreeca/core`
- `@metreeca/wire-sparql` — `./rdf` `Some` type export; the zero/one/many input shape is now sourced from
  `@metreeca/core`

## [0.9.0](https://github.com/metreeca/wire/releases/tag/v0.9.0)

### Added

- `@metreeca/wire-sparql` — SPARQL connector framework with `Repository` interface, N-Triples codec, RDF DSL,
  and SPARQL query/update combinators
- `@metreeca/wire-sparql-http` — SPARQL 1.1 Protocol endpoint connector
- `@metreeca/wire-sparql-oxigraph` — Oxigraph in-memory WASM store connector
- `@metreeca/wire-sparql-rdf4j` — RDF4J REST API endpoint connector with server-managed transaction support
