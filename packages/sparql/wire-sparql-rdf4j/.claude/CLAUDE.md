# References

- [RDF4J REST API](https://rdf4j.org/documentation/reference/rest-api/) - REST protocol for RDF4J Server repositories
- [RDF4J REST API Transactions](https://rdf4j.org/documentation/reference/rest-api/#transactions) - Transaction
  management protocol for atomic multi-statement updates
- [SPARQL 1.1 Protocol](https://www.w3.org/TR/sparql11-protocol/) - W3C HTTP protocol for SPARQL query and update

> [!NOTE]
> This connector delegates all non-transactional SPARQL exchanges to `@metreeca/wire-sparql-http`
> (`createHTTPRepository`) and layers RDF4J server-managed transactions and operation settings on top. Its tests
> (`src/index.test.ts`) run against a stub `fetch` and cover only what the connector adds to the HTTP connector: the
> forwarding of the `infer` and `timeout` settings and of dataset parameters to every endpoint, transactional ones
> included, the routing of graph store writes to the Graph Store Protocol service and to transaction `ADD` operations,
> and the rejection of `timeout` values that are not positive integers, raised as a `TypeError` at construction.
