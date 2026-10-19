/*
 * Copyright © 2026 Metreeca srl
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { blank, named, tagged, typed } from "@metreeca/trio";
import { NTriples } from "@metreeca/trio/ntriples";
import { SPARQLResults } from "@metreeca/wire-sparql";
import { describe, expect, test, vi } from "vitest";
import { decodeTerm, decodeTuples } from "./index.core.js";
import { createHTTPRepository } from "./index.js";


describe("createHTTPRepository", () => {

	describe("datasets", () => {

		const query = "http://example.org/sparql";

		const g1 = "http://example.org/g1";
		const g2 = "http://example.org/g2";
		const n1 = "http://example.org/n1";


		/**
		 * Builds a stub endpoint answering every exchange with a minimal successful response.
		 */
		function stub() {

			return vi.fn<typeof globalThis.fetch>(async (input, init) => {

				const accept = new Request(input, init).headers.get("Accept");

				return accept === SPARQLResults
					? new Response(JSON.stringify({ head: {}, boolean: true, results: { bindings: [] } }), {
						headers: { "Content-Type": SPARQLResults }
					})
					: accept === NTriples
						? new Response("", { headers: { "Content-Type": NTriples } })
						: new Response(null, { status: 204 });

			});

		}

		/**
		 * Lists the URL parameters of the exchanges a stub received, as name/value pairs in request order.
		 */
		function parameters(fetch: ReturnType<typeof stub>) {

			return fetch.mock.calls.map(([input, init]) => [...new URL(new Request(input, init).url).searchParams]);

		}


		test("omits dataset parameters when no dataset is given", async () => {

			const fetch = stub();
			const http = createHTTPRepository({ query, fetch });

			await http.ask("ask {}");
			await http.update("insert data {}");

			expect(parameters(fetch)).toEqual([[], []]);

		});

		test("omits dataset parameters when the dataset lists no graphs", async () => {

			const fetch = stub();
			const http = createHTTPRepository({ query, fetch });

			await http.ask("ask {}", {});
			await http.update("insert data {}", { default: [], named: [] });

			expect(parameters(fetch)).toEqual([[], []]);

		});

		test("forwards query datasets as default and named graph parameters", async () => {

			const fetch = stub();
			const http = createHTTPRepository({ query, fetch });
			const dataset = { default: [g1, g2], named: [n1] };

			await http.ask("ask {}", dataset);
			await http.select("select * {}", dataset);
			await http.construct("construct {} where {}", dataset);

			expect(parameters(fetch)).toEqual(Array(3).fill([
				["default-graph-uri", g1],
				["default-graph-uri", g2],
				["named-graph-uri", n1]
			]));

		});

		test("forwards update datasets as using graph parameters", async () => {

			const fetch = stub();
			const http = createHTTPRepository({ query, fetch });

			await http.update("delete where { ?s ?p ?o }", { default: [g1, g2], named: [n1] });

			expect(parameters(fetch)).toEqual([[
				["using-graph-uri", g1],
				["using-graph-uri", g2],
				["using-named-graph-uri", n1]
			]]);

		});

		test("extends endpoint URLs already carrying parameters", async () => {

			const fetch = stub();
			const http = createHTTPRepository({ query: `${query}?infer=false`, fetch });

			await http.ask("ask {}", { named: [n1] });

			expect(parameters(fetch)).toEqual([[
				["infer", "false"],
				["named-graph-uri", n1]
			]]);

		});

		test("propagates endpoint errors on conflicting update datasets", async () => {

			const fetch = vi.fn<typeof globalThis.fetch>(async () =>
				new Response("conflicting dataset", { status: 400, headers: { "Content-Type": "text/plain" } })
			);

			const http = createHTTPRepository({ query, fetch });

			await expect(http.update("with <http://example.org/w> delete where { ?s ?p ?o }", { default: [g1] }))
				.rejects.toMatchObject({ status: 400 });

		});

	});

});


describe("bindings", () => {

	test("decodes an empty result set", () => {

		expect(decodeTuples({ results: { bindings: [] } })).toEqual([]);

	});

	test("decodes a row with numeric variable indices", () => {

		expect(decodeTuples({
			results: {
				bindings: [{
					"0": { type: "uri", value: "http://example.com/s" },
					"1": { type: "literal", value: "v" }
				}]
			}
		})).toEqual([
			{ "?0": named("http://example.com/s"), "?1": typed("v") }
		]);

	});

	test("decodes a string variable name", () => {

		expect(decodeTuples({
			results: {
				bindings: [{
					"v0": { type: "uri", value: "http://example.com/" }
				}]
			}
		})).toEqual([
			{ "?v0": named("http://example.com/") }
		]);

	});

	test("rejects a malformed variable name", () => {

		expect(() => decodeTuples({
			results: {
				bindings: [{
					"a b": { type: "uri", value: "http://example.com/" }
				}]
			}
		})).toThrow(RangeError);

	});

});

describe("named", () => {

	test("boxes an IRI into a named resource", () => {

		expect(named("http://example.com/")).toEqual({ kind: "named", iri: "http://example.com/" });

	});

	test("rejects a blank-node label", () => {

		expect(() => named("_:b1")).toThrow(RangeError);

	});

});

describe("term", () => {

	test("decodes a uri binding", () => {

		expect(decodeTerm({ type: "uri", value: "http://example.com/" })).toEqual(named("http://example.com/"));

	});

	test("decodes a plain literal as xsd:string", () => {

		expect(decodeTerm({ type: "literal", value: "v" })).toEqual(typed("v"));

	});

	test("decodes a datatype-typed literal", () => {

		expect(decodeTerm({
			type: "literal",
			value: "42",
			datatype: "http://www.w3.org/2001/XMLSchema#integer"
		})).toEqual(typed("42", "http://www.w3.org/2001/XMLSchema#integer"));

	});

	test("decodes a language-tagged literal via xml:lang", () => {

		expect(decodeTerm({ type: "literal", value: "hi", "xml:lang": "en" })).toEqual(tagged("hi", "en"));

	});

	test("decodes a language-tagged literal via lang", () => {

		expect(decodeTerm({ type: "literal", value: "hi", lang: "en" })).toEqual(tagged("hi", "en"));

	});

	test("decodes a legacy typed-literal", () => {

		expect(decodeTerm({
			type: "typed-literal",
			value: "42",
			datatype: "http://www.w3.org/2001/XMLSchema#integer"
		})).toEqual(typed("42", "http://www.w3.org/2001/XMLSchema#integer"));

	});

	test("rejects a uri binding holding a blank-node label", () => {

		expect(() => decodeTerm({ type: "uri", value: "_:b1" })).toThrow(RangeError);

	});

	test("decodes a bnode binding to a scope-numbered Blank", () => {

		const decoded = decodeTerm({ type: "bnode", value: "b1" });

		expect(decoded).toEqual(blank(0));

	});

});
