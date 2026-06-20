# @metreeca/wire-sparql-oxigraph

[![npm](https://img.shields.io/npm/v/@metreeca/wire-sparql-oxigraph)](https://www.npmjs.com/package/@metreeca/wire-sparql-oxigraph)

SPARQL connector for [@metreeca/wire](https://github.com/metreeca/wire) backed by an Oxigraph in-memory WASM store.

Exposes an [Oxigraph](https://oxigraph.org/) WASM store through the common [@metreeca/wire-sparql] `Repository`
interface, running entirely in-process with no external server required.

# Installation

```shell
npm install @metreeca/wire-sparql           # the SPARQL query API
npm install @metreeca/wire-sparql-oxigraph  # this connector
npm install oxigraph                        # peer dependency
```

> [!WARNING]
>
> TypeScript consumers must use `"moduleResolution": "nodenext"/"node16"/"bundler"` in `tsconfig.json`.
> The legacy `"node"` resolver is not supported.

# Usage

Create an in-process Oxigraph store with `createOxiRepository`, then issue queries and updates through the
[@metreeca/wire-sparql] `Repository` API:

```typescript
import { createOxiRepository } from "@metreeca/wire-sparql-oxigraph";

const repository = createOxiRepository();
```

See [@metreeca/wire-sparql] for the `Repository` query API (`ask`, `select`, `construct`, `update`, `execute`, `close`).

> [!IMPORTANT]
>
> This connector provides no transaction isolation: updates apply immediately to the in-memory store, with no `execute` bracketing.

[@metreeca/wire-sparql]: https://metreeca.github.io/wire/modules/_metreeca_wire-sparql.html

# Support

- open an [issue](https://github.com/metreeca/wire/issues) to report a problem or to suggest a new feature
- start a [discussion](https://github.com/metreeca/wire/discussions) to ask a how-to question or to share an idea

# License

This project is licensed under the Apache 2.0 License –
see [LICENSE](https://github.com/metreeca/wire?tab=Apache-2.0-1-ov-file) file for details.
