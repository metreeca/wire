# References

- [RDF4J REST API](https://rdf4j.org/documentation/reference/rest-api/) - REST protocol for RDF4J Server repositories
- [RDF4J REST API Transactions](https://rdf4j.org/documentation/reference/rest-api/#transactions) - Transaction
  management protocol for atomic multi-statement updates
- [SPARQL 1.1 Protocol](https://www.w3.org/TR/sparql11-protocol/) - W3C HTTP protocol for SPARQL query and update

> [!NOTE]
> This connector delegates all non-transactional SPARQL exchanges to `@metreeca/wire-sparql-http`
> (`createHTTPRepository`) and layers RDF4J server-managed transactions on top. It has no test of its own; its
> conformance is exercised from `wire-sparql` (`packages/wire-sparql/src/index.test.ts`), where the **Verified
> Backends** table is also maintained.
