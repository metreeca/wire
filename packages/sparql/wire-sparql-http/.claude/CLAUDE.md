---
title: SPARQL HTTP Connector Guidelines
description: Development guidelines for the SPARQL 1.1 Protocol HTTP connector.
---

# References

- [SPARQL 1.1 Query](https://www.w3.org/TR/sparql11-query/) - W3C query language for RDF
- [SPARQL 1.1 Protocol](https://www.w3.org/TR/sparql11-protocol/) - W3C HTTP protocol for SPARQL query and update
- [RDF4J REST API Transactions](https://rdf4j.org/documentation/reference/rest-api/#transactions) - Transaction
  management protocol for atomic multi-statement updates

> [!NOTE]
> This connector is a pure `@metreeca/wire-sparql` implementation. Its tests (`src/index.test.ts`) run against a stub
> `fetch` and cover the result decoders, the dataset parameters and the graph store exchanges, through both the Graph
> Store Protocol endpoint and the SPARQL update fallback used when no such endpoint is configured.
