---
title: Oxigraph Connector Guidelines
description: Development guidelines for the in-memory Oxigraph WASM connector.
---

# References

- [Oxigraph JS](https://github.com/oxigraph/oxigraph/blob/main/js/README.md) - In-memory JavaScript/WASM SPARQL store
  embedded in-process

> [!NOTE]
> This is a general-purpose `@metreeca/wire-sparql` connector, not merely a test fixture: it runs in-process, with no
> external server or Docker container to set up. Its tests (`src/index.test.ts`) run against a live in-memory store and
> cover how datasets are applied and how graph store writes merge into or replace graph content, blank nodes included.
