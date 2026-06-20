# W3C N-Triples Test Suite

Unmodified copies of the RDF 1.1 Working Group N-Triples syntax test suite, vendored as fixtures for
`../w3c-ntriples.test.ts`.

- **Source**: <https://github.com/w3c/rdf-tests> (`rdf/rdf11/rdf-n-triples`)
- **Home**: <https://w3c.github.io/rdf-tests/rdf/rdf11/rdf-n-triples/>
- **License**: dual-licensed per
  [Licenses for W3C Test Suites](https://www.w3.org/Consortium/Legal/2008/04-testsuite-copyright.html)

`manifest.ttl` classifies each entry as a positive syntax test (`rdft:TestNTriplesPositiveSyntax`, valid input that must
parse) or a negative syntax test (`rdft:TestNTriplesNegativeSyntax`, malformed input that must be rejected). The test
driver reads the manifest to discover and classify every `mf:action` file.
