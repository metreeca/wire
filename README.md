# @metreeca/wire

[![npm](https://img.shields.io/npm/v/@metreeca/wire)](https://www.npmjs.com/package/@metreeca/wire)

Pluggable storage connectors for relational and graph databases.

**@metreeca/wire** wires concrete database backends behind a common query interface per query-language family, so
application code targets a query language rather than a product-specific driver or dialect:

- **One API per Family**: a single query interface serves every backend in a query-language family
- **Pluggable Backends**: switch database products without rewriting query code

Connectors are self-contained leaf packages:

- **Lean Dependencies**: connectors share no intermediate package and pull in only what each backend needs
- **Consumer-Agnostic**: usable from any application layer, with no framework assumptions
- **Incremental Adoption**: install only the connectors an application actually uses

# Installation

Install the framework package for your target query language, then add a backend connector for your target engine. The
framework provides the query API your code imports, so keep it as a direct dependency; the connector pulls it in
transitively. See each **Framework Package** below for its connectors, peer dependencies, and target engines.

| Query Language   | Description                            | Framework Package       |
|------------------|----------------------------------------|-------------------------|
| **[SQL:2011]**   | ISO/IEC 9075 Structured Query Language | *upcoming*              |
| **[GQL:2024]**   | ISO/IEC 39075 Graph Query Language     | *upcoming*              |
| **[SPARQL 1.1]** | SPARQL 1.1 Query Language              | [@metreeca/wire-sparql] |

[SQL:2011]: https://www.iso.org/standard/53681.html

[GQL:2024]: https://www.iso.org/standard/76120.html

[SPARQL 1.1]: https://www.w3.org/TR/sparql11-query/

[@metreeca/wire-sparql]: https://metreeca.github.io/wire/modules/_metreeca_wire-sparql.html

```shell
npm install @metreeca/wire-<language>            # a query-language framework from the table above
npm install @metreeca/wire-<language>-<backend>  # a backend connector, among those listed by the framework
npm install <peer-dependency>                    # connector peer dependencies, where required
```

> [!WARNING]
>
> TypeScript consumers must use `"moduleResolution": "nodenext"/"node16"/"bundler"` in `tsconfig.json`.
> The legacy `"node"` resolver is not supported.

# Usage

> [!NOTE]
>
> Each framework package documents its query API and usage in its own documentation and API reference:
>
> | Query Language | Framework Package       |
> |----------------|-------------------------|
> | SPARQL 1.1     | [@metreeca/wire-sparql] |

# Support

- open an [issue](https://github.com/metreeca/wire/issues) to report a problem or to suggest a new feature
- start a [discussion](https://github.com/metreeca/wire/discussions) to ask a how-to question or to share an idea

# License

This project is licensed under the Apache 2.0 License –
see [LICENSE](https://github.com/metreeca/wire?tab=Apache-2.0-1-ov-file) file for details.
