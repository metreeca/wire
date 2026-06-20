# @metreeca/wire-sparql-http

[![npm](https://img.shields.io/npm/v/@metreeca/wire-sparql-http)](https://www.npmjs.com/package/@metreeca/wire-sparql-http)

SPARQL connector for [@metreeca/wire](https://github.com/metreeca/wire) backed by a SPARQL 1.1 Protocol endpoint.

Exposes any [SPARQL 1.1 Protocol](https://www.w3.org/TR/sparql11-protocol/) compliant endpoint through the common
[@metreeca/wire-sparql] `Repository` interface, issuing each query and update as a single HTTP request. For [RDF4J
Server](https://rdf4j.org/) repositories with server-managed transactions, use the companion
[@metreeca/wire-sparql-rdf4j] connector.

# Installation

```shell
npm install @metreeca/wire-sparql         # the SPARQL query API
npm install @metreeca/wire-sparql-http    # this connector
```

> [!WARNING]
>
> TypeScript consumers must use `"moduleResolution": "nodenext"/"node16"/"bundler"` in `tsconfig.json`.
> The legacy `"node"` resolver is not supported.

# Usage

Connect to a SPARQL 1.1 Protocol endpoint with `createHTTPRepository`, then issue queries and updates through the
[@metreeca/wire-sparql] `Repository` API:

```typescript
import { createHTTPRepository } from "@metreeca/wire-sparql-http";

const repository = createHTTPRepository({
	query: "https://example.org/sparql",
	update: "https://example.org/sparql/statements"
});
```

See [@metreeca/wire-sparql] for the `Repository` query API (`ask`, `select`, `construct`, `update`, `execute`, `close`).

> [!IMPORTANT]
>
> This connector provides no transaction isolation: the SPARQL 1.1 Protocol exposes no transaction primitives, so each query and update is
> dispatched eagerly as a single HTTP request and `execute` runs its task directly, without bracketing. A
> multi-statement update is atomic only insofar as the endpoint applies it atomically.

[@metreeca/wire-sparql]: https://metreeca.github.io/wire/modules/_metreeca_wire-sparql.html

[@metreeca/wire-sparql-rdf4j]: https://metreeca.github.io/wire/modules/_metreeca_wire-sparql-rdf4j.html

# Support

- open an [issue](https://github.com/metreeca/wire/issues) to report a problem or to suggest a new feature
- start a [discussion](https://github.com/metreeca/wire/discussions) to ask a how-to question or to share an idea

# License

This project is licensed under the Apache 2.0 License –
see [LICENSE](https://github.com/metreeca/wire?tab=Apache-2.0-1-ov-file) file for details.
