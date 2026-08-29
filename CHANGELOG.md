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
- `@metreeca/wire-sparql` — `sparql` tag, marking a string or a template literal as SPARQL text and realigning it as
  `dedent` does
- `@metreeca/wire-sparql` — `./builder` query and update combinators: `ask`, `select`, `all`, `where`, `insert`,
  `deleet`, and `update`
- `@metreeca/wire-sparql` — `./builder` RDF dataset clause combinators: `from` and `fromNamed` declaring a query's
  default and named graphs, and `witt`, `using`, and `usingNamed` declaring an update's target, default, and named
  graphs
- `@metreeca/wire-sparql` — `./builder` expression combinators for the SPARQL built-in function library: arithmetic
  operators (`add`, `sub`, `mul`, `div`), the `isNotIn` membership test, RDF term constructors (`iri`, `bnode`,
  `strdt`, `strlang`, `uuid`, `struuid`), string functions (`strlen`, `substr`, `ucase`, `lcase`, `strstarts`,
  `strends`, `contains`, `strbefore`, `strafter`, `encodeForUri`, `concat`, `regex`, `replace`), numeric functions
  (`abs`, `round`, `ceil`, `floor`, `rand`), temporal functions (`now`, `year`, `month`, `day`, `hours`, `minutes`,
  `seconds`, `timezone`, `tz`), and hash functions (`md5`, `sha1`, `sha256`, `sha384`, `sha512`)
- `@metreeca/wire-sparql` — `./builder` scalar term serialisers `boolean`, `number`, and `string`, rendering JavaScript
  scalar values into their most compact SPARQL term forms
- `@metreeca/wire-sparql` — `./builder` `Mixed` variadic parameter type, letting combinators accept both spread values
  and a pre-built array in a single argument list

### Changed

- `@metreeca/wire-sparql` — `Repository` now extends `RepositoryClient`, and `Repository.execute` hands the task a
  `RepositoryClient` instead of a full `Repository`
- `@metreeca/wire-sparql` — renamed the `./builder` `alias` projection combinator to `as`
- `@metreeca/wire-sparql` — `./builder` variadic combinators now drop empty operands (such as those produced by `nil`)
  before joining, so optional operands left out introduce no redundant separators
- `@metreeca/wire-sparql` — `./builder` group and block pattern combinators (`where`, `group`, `optional`, `minus`,
  `graph`, `service`, `exists`, `nexists`) and the `groupBy`, `orderBy`, and `having` clause modifiers now drop empty
  clauses and yield the empty fragment when none survive; `limit` and `offset` yield the empty fragment for a count of
  `0`, and `having` brackets and conjoins its variadic conditions with `&&`
- `@metreeca/wire-sparql` — `./builder` variadic combinators now accept the `Mixed` argument shape, taking spread values
  (`f(a, b, c)`) and a pre-built array (`f([a, b, c])`) interchangeably
- `@metreeca/wire-sparql` — renamed the `./dsl` SPARQL query and update module to `./builder`
- `@metreeca/wire-sparql` — the RDF data model (term and statement types, factories, and `skolemize`), the graph
  builder, and the N-Triples codec are now sourced from `@metreeca/trio`, taken as a direct dependency by every
  package, rather than defined in-package
- `@metreeca/wire-sparql` — replaced the `media` media type namespace with the standalone `SPARQLQuery`,
  `SPARQLUpdate`, and `SPARQLResults` constants; the N-Triples media type is now sourced from `@metreeca/trio/ntriples`
  as `NTriples`
- `@metreeca/wire-sparql` — `variable` now accepts any name matching the SPARQL `VARNAME` production, rather than only
  ASCII letters, digits, and underscores
- every package now requires `@metreeca/core` `^0.9.21`, up from `^0.9.19`

### Removed

- `@metreeca/wire-sparql` — RDF data model exports: the `Term`, `Blank`, `Reference`, `Tagged`, `Typed`, `Triple`, and
  `Graph` types, their `is*` guards, the `blank`, `reference`, `tagged`, `typed`, `triple`, and `graph` factories, and
  `skolemize`; the term model is now sourced from `@metreeca/trio`, where `Reference` is named `Named`
- `@metreeca/wire-sparql` — `Subject`, `Predicate`, and `Object` triple position types, inlined into the positions of
  `Pattern`
- `@metreeca/wire-sparql` — `isTuple`, `isPattern`, and `isVariable` guards
- `@metreeca/wire-sparql` — `./rdf` graph DSL and `./codecs/ntriples` codec modules; both are now sourced from
  `@metreeca/trio` and `@metreeca/trio/ntriples` respectively
- `@metreeca/wire-sparql` — `./builder` `literal` term serialiser, superseded by the `string`, `tagged`, and `typed`
  serialisers
- `@metreeca/wire-sparql` — `rdf` and `xsd` namespace exports; the `xsd` datatype namespace is now sourced from
  `@metreeca/core` and the `rdf` vocabulary namespace from `@metreeca/trio`

## [0.9.0](https://github.com/metreeca/wire/releases/tag/v0.9.0)

### Added

- `@metreeca/wire-sparql` — SPARQL connector framework with `Repository` interface, N-Triples codec, RDF DSL,
  and SPARQL query/update combinators
- `@metreeca/wire-sparql-http` — SPARQL 1.1 Protocol endpoint connector
- `@metreeca/wire-sparql-oxigraph` — Oxigraph in-memory WASM store connector
- `@metreeca/wire-sparql-rdf4j` — RDF4J REST API endpoint connector with server-managed transaction support
