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
> This connector is a pure `@metreeca/wire-sparql` implementation with no test of its own; its conformance is exercised
> from `wire-sparql` (`packages/wire-sparql/src/index.test.ts`), where the **Verified Backends** table is also
> maintained.
