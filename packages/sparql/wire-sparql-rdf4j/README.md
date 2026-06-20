# @metreeca/wire-sparql-rdf4j

[![npm](https://img.shields.io/npm/v/@metreeca/wire-sparql-rdf4j)](https://www.npmjs.com/package/@metreeca/wire-sparql-rdf4j)

SPARQL connector for [@metreeca/wire](https://github.com/metreeca/wire) backed by an RDF4J Server repository.

Exposes any [RDF4J Server](https://rdf4j.org/) repository through the common [@metreeca/wire-sparql] `Repository`
interface, bracketing each task in a server-managed transaction. One-off operations outside a transaction are delegated
to the [SPARQL 1.1 Protocol](https://www.w3.org/TR/sparql11-protocol/) through the companion
[@metreeca/wire-sparql-http] connector.

# Installation

```shell
npm install @metreeca/wire-sparql         # the SPARQL query API
npm install @metreeca/wire-sparql-rdf4j   # this connector
```

> [!WARNING]
>
> TypeScript consumers must use `"moduleResolution": "nodenext"/"node16"/"bundler"` in `tsconfig.json`.
> The legacy `"node"` resolver is not supported.

# Usage

Connect to an RDF4J Server repository with `createRDF4JRepository`, then issue queries and updates through the
[@metreeca/wire-sparql] `Repository` API:

```typescript
import { createRDF4JRepository } from "@metreeca/wire-sparql-rdf4j";

const repository = createRDF4JRepository({
	server: "https://example.org/rdf4j-server",
	repository: "my-repo"
});
```

See [@metreeca/wire-sparql] for the `Repository` query API (`ask`, `select`, `construct`, `update`, `execute`, `close`).

> [!IMPORTANT]
>
> This connector defers transaction isolation to the configured RDF4J repository: server-managed transactions bracket each task
> for atomic commit and rollback, achieving the isolation level of the underlying store (RDF4J's MemoryStore and
> NativeStore both default to `SNAPSHOT_READ`). The REST API exposes no isolation-level parameter on the
> start-transaction call.

[@metreeca/wire-sparql]: https://metreeca.github.io/wire/modules/_metreeca_wire-sparql.html

[@metreeca/wire-sparql-http]: https://metreeca.github.io/wire/modules/_metreeca_wire-sparql-http.html

# Support

- open an [issue](https://github.com/metreeca/wire/issues) to report a problem or to suggest a new feature
- start a [discussion](https://github.com/metreeca/wire/discussions) to ask a how-to question or to share an idea

# License

This project is licensed under the Apache 2.0 License –
see [LICENSE](https://github.com/metreeca/wire?tab=Apache-2.0-1-ov-file) file for details.
