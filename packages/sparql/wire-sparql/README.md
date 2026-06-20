# @metreeca/wire-sparql

[![npm](https://img.shields.io/npm/v/@metreeca/wire-sparql)](https://www.npmjs.com/package/@metreeca/wire-sparql)

SPARQL 1.1 query language framework for [@metreeca/wire](https://github.com/metreeca/wire) storage connectors.

Provides a uniform `Repository` interface for issuing SPARQL queries and updates against any backend (an embedded store,
a remote endpoint, or a managed server), without binding application code to a specific store or client. It also bundles
the building blocks for working with the data exchanged, such as an RDF term model, DSLs for composing SPARQL queries
and RDF graphs, and codecs for RDF serialisations.

# Installation

Install this framework together with a backend connector for your target engine, plus any peer dependency the connector
requires:

```shell
npm install @metreeca/wire-sparql                # the SPARQL query API (this framework)
npm install @metreeca/wire-sparql-<backend>      # backend connector from the table below
npm install <peer-dependency>                    # connector's peer dependency, where required
```

> [!WARNING]
>
> TypeScript consumers must use `"moduleResolution": "nodenext"/"node16"/"bundler"` in `tsconfig.json`.
> The legacy `"node"` resolver is not supported.

| Connector Package                | Peer Dependency    | Engine                          |
|----------------------------------|--------------------|---------------------------------|
| [@metreeca/wire-sparql-http]     | -                  | [SPARQL 1.1 Protocol] endpoint  |
| [@metreeca/wire-sparql-rdf4j]    | -                  | [RDF4J REST API] endpoint       |
| [@metreeca/wire-sparql-oxigraph] | `oxigraph >=0.5.0` | [Oxigraph] in-memory WASM store |

[@metreeca/wire-sparql-http]: https://metreeca.github.io/wire/modules/_metreeca_wire-sparql-http.html

[SPARQL 1.1 Protocol]: https://www.w3.org/TR/sparql11-protocol/

[@metreeca/wire-sparql-rdf4j]: https://metreeca.github.io/wire/modules/_metreeca_wire-sparql-rdf4j.html

[RDF4J REST API]: https://rdf4j.org/documentation/reference/rest-api/

[@metreeca/wire-sparql-oxigraph]: https://metreeca.github.io/wire/modules/_metreeca_wire-sparql-oxigraph.html

[Oxigraph]: https://github.com/oxigraph/oxigraph

# Usage

> [!NOTE]
>
> This section introduces essential concepts; for complete coverage, see the
> [API reference](https://metreeca.github.io/wire/modules/_metreeca_wire-sparql.html).

## Querying a Backend

Obtain a `Repository` from any backend connector, then run SPARQL queries and updates through its methods:

```typescript
import { createHTTPRepository } from "@metreeca/wire-sparql-http";

const repository = createHTTPRepository({
	query: "https://example.org/sparql",
	update: "https://example.org/sparql/statements"
});

await repository.update(`
	INSERT DATA { <https://example.org/widget> <https://schema.org/name> "Widget" }
`);

const tuples = await repository.select(`
	SELECT ?name { ?product <https://schema.org/name> ?name }
`); // readonly Tuple[]: each maps the ?name token to a Term

const present = await repository.ask(`ASK { ?s ?p ?o }`);

const triples = await repository.construct(`
	CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }
`); // readonly Triple[]

await repository.close();
```

## Transactions

Bracket related operations with `execute`: the task runs on a per-call `Repository` and commits together, or rolls back
if it throws:

```typescript
await repository.execute(async tx => {
	await tx.update(`DELETE WHERE { <https://example.org/widget> ?p ?o }`);
	await tx.update(`INSERT DATA { <https://example.org/widget> <https://schema.org/name> "Gadget" }`);
});
```

> [!IMPORTANT]
>
> Transaction isolation is backend-dependent. A backend with native transactions brackets the task for atomic commit
> and rollback; one without runs the task directly against the same `Repository`, with no atomicity or rollback. Each
> connector documents the level it provides on its factory function.

## Implementing a Connector

A backend connector implements the `Repository` interface (`ask`, `select`, `construct`, `update`, `execute`, and
`close`), lifting native backend nodes into the shared term model with the `reference`, `tagged`, and `typed`
constructors, and parsing or serialising RDF payloads with the `codecs/ntriples` module.

A minimal connector has the shape:

```typescript
import type { Repository, SPARQL } from "@metreeca/wire-sparql";

function createMyRepository(/* endpoint, client, … */): Repository {

	const repository: Repository = {

		ask: async (query: SPARQL) => { /* run ASK; return the boolean */ },

		select: async (query: SPARQL) => { /* run SELECT; map bindings to Tuples of Terms */ },

		construct: async (query: SPARQL) => { /* run CONSTRUCT; map statements to Triples */ },

		update: async (update: SPARQL) => { /* apply the UPDATE */ },

		execute: async task => task(repository),  // or bracket the task in a backend transaction

		close: async () => { /* release resources, or no-op */ }

	};

	return repository;
}
```

> [!TIP]
>
> Each SPARQL connector in the [@metreeca/wire](https://github.com/metreeca/wire) monorepo is a complete, working
> implementation that you can read to learn the approach or adapt for a new engine.

# Support

- open an [issue](https://github.com/metreeca/wire/issues) to report a problem or to suggest a new feature
- start a [discussion](https://github.com/metreeca/wire/discussions) to ask a how-to question or to share an idea

# License

This project is licensed under the Apache 2.0 License –
see [LICENSE](https://github.com/metreeca/wire?tab=Apache-2.0-1-ov-file) file for details.
