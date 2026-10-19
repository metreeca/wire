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

import { named, triple, typed } from "@metreeca/trio";
import { NTriples } from "@metreeca/trio/ntriples";
import { SPARQLResults, SPARQLUpdate } from "@metreeca/wire-sparql";
import { describe, expect, it, vi } from "vitest";
import { createRDF4JRepository } from "./index.js";


describe("createRDF4JRepository", () => {

	describe("operation settings", () => {

		const server = "http://example.org/rdf4j-server";
		const repository = "test";

		const txns = `${server}/repositories/${repository}/transactions`;
		const txn = `${txns}/txn`;

		const g = "http://example.org/g";
		const n = "http://example.org/n";

		const dataset = { default: [g], named: [n] };


		/**
		 * Builds a stub RDF4J Server answering every exchange with a minimal successful response.
		 */
		function stub() {

			return vi.fn<typeof globalThis.fetch>(async (input, init) => {

				const request = new Request(input, init);

				return request.method === "POST" && request.url === txns
					? new Response(null, { status: 201, headers: { "Location": txn } })
					: request.headers.get("Accept") === SPARQLResults
						? new Response(JSON.stringify({ head: {}, boolean: true }), { headers: { "Content-Type": SPARQLResults } })
						: new Response(null, { status: 204 });

			});

		}

		/**
		 * Lists the URL parameters of the exchanges a stub received, excluding transaction bracketing.
		 */
		function parameters(fetch: ReturnType<typeof stub>) {

			return fetch.mock.calls
				.map(([input, init]) => new URL(new Request(input, init).url))
				.filter(url => url.href !== txns && url.searchParams.get("action") !== "COMMIT")
				.map(url => Object.fromEntries([...url.searchParams].filter(([name]) => name !== "action")));

		}


		it("omits settings by default", async () => {

			const fetch = stub();
			const rdf4j = createRDF4JRepository({ server, repository, fetch });

			await rdf4j.ask("ask {}");
			await rdf4j.update("insert data {}");

			expect(parameters(fetch)).toEqual([{}, {}]);

		});

		it("forwards settings to queries and updates", async () => {

			const fetch = stub();
			const rdf4j = createRDF4JRepository({ server, repository, infer: false, timeout: 30, fetch });

			await rdf4j.ask("ask {}");
			await rdf4j.update("insert data {}");

			expect(parameters(fetch)).toEqual([
				{ infer: "false", timeout: "30" },
				{ infer: "false", timeout: "30" }
			]);

		});

		it("forwards settings within transactions", async () => {

			const fetch = stub();
			const rdf4j = createRDF4JRepository({ server, repository, infer: true, timeout: 30, fetch });

			await rdf4j.execute(async client => {
				await client.ask("ask {}");
				await client.update("insert data {}");
			});

			expect(parameters(fetch)).toEqual([
				{ infer: "true", timeout: "30" },
				{ infer: "true", timeout: "30" }
			]);

		});

		it("forwards datasets alongside settings", async () => {

			const fetch = stub();
			const rdf4j = createRDF4JRepository({ server, repository, infer: false, fetch });

			await rdf4j.ask("ask {}", dataset);
			await rdf4j.update("delete where { ?s ?p ?o }", dataset);

			expect(parameters(fetch)).toEqual([
				{ "infer": "false", "default-graph-uri": g, "named-graph-uri": n },
				{ "infer": "false", "using-graph-uri": g, "using-named-graph-uri": n }
			]);

		});

		it("forwards datasets within transactions", async () => {

			const fetch = stub();
			const rdf4j = createRDF4JRepository({ server, repository, infer: false, fetch });

			await rdf4j.execute(async client => {
				await client.ask("ask {}", dataset);
				await client.update("delete where { ?s ?p ?o }", dataset);
			});

			expect(parameters(fetch)).toEqual([
				{ "infer": "false", "default-graph-uri": g, "named-graph-uri": n },
				{ "infer": "false", "using-graph-uri": g, "using-named-graph-uri": n }
			]);

		});

		it.each([0, -1, 1.5, Number.NaN])("rejects timeout <%s>", async timeout => {

			expect(() => createRDF4JRepository({ server, repository, timeout, fetch: stub() })).toThrow(TypeError);

		});

	});

	describe("graph store", () => {

		const server = "http://example.org/rdf4j-server";
		const repository = "test";

		const graphs = `${server}/repositories/${repository}/rdf-graphs/service`;
		const txns = `${server}/repositories/${repository}/transactions`;
		const txn = `${txns}/txn`;

		const g = "http://example.org/g";

		const statements = [triple(named("http://example.org/s"), named("http://example.org/p"), typed("o"))];
		const encoded = "<http://example.org/s> <http://example.org/p> \"o\" .";


		/**
		 * Builds a stub RDF4J Server answering every exchange with a minimal successful response.
		 */
		function stub() {

			return vi.fn<typeof globalThis.fetch>(async (input, init) => {

				const request = new Request(input, init);

				return request.method === "POST" && request.url === txns
					? new Response(null, { status: 201, headers: { "Location": txn } })
					: new Response(null, { status: 204 });

			});

		}

		/**
		 * Lists the exchanges a stub received, excluding transaction bracketing, as method, URL parameters, content
		 * type and body in request order.
		 */
		async function exchanges(fetch: ReturnType<typeof stub>) {

			const requests = fetch.mock.calls
				.map(([input, init]) => new Request(input, init))
				.filter(request => request.url !== txns && !request.url.includes("action=COMMIT"));

			return Promise.all(requests.map(async request => ({
				method: request.method,
				url: request.url.split("?")[0],
				parameters: Object.fromEntries(new URL(request.url).searchParams),
				type: request.headers.get("Content-Type"),
				body: await request.text()
			})));

		}


		describe("outside a transaction", () => {

			it("merges triples into the graph store service", async () => {

				const fetch = stub();

				await createRDF4JRepository({ server, repository, fetch }).merge(statements, g);

				expect(await exchanges(fetch)).toEqual([{
					method: "POST",
					url: graphs,
					parameters: { graph: g },
					type: NTriples,
					body: expect.stringContaining(encoded)
				}]);

			});

			it("stores triples into the default graph of the graph store service", async () => {

				const fetch = stub();

				await createRDF4JRepository({ server, repository, fetch }).store(statements);

				expect(await exchanges(fetch)).toEqual([{
					method: "PUT",
					url: graphs,
					parameters: { default: "" },
					type: NTriples,
					body: expect.stringContaining(encoded)
				}]);

			});

		});

		describe("within a transaction", () => {

			it("merges triples as a transaction ADD into the graph context", async () => {

				const fetch = stub();

				await createRDF4JRepository({ server, repository, fetch }).execute(async client => {
					await client.merge(statements, g);
				});

				expect(await exchanges(fetch)).toEqual([{
					method: "PUT",
					url: txn,
					parameters: { action: "ADD", context: `<${g}>` },
					type: NTriples,
					body: expect.stringContaining(encoded)
				}]);

			});

			it("merges triples into the null context for the default graph", async () => {

				const fetch = stub();

				await createRDF4JRepository({ server, repository, fetch }).execute(async client => {
					await client.merge(statements);
				});

				expect((await exchanges(fetch)).map(({ parameters }) => parameters)).toEqual([
					{ action: "ADD", context: "null" }
				]);

			});

			it("stores triples as a DROP SILENT update followed by a transaction ADD", async () => {

				const fetch = stub();

				await createRDF4JRepository({ server, repository, fetch }).execute(async client => {
					await client.store(statements, g);
				});

				expect(await exchanges(fetch)).toEqual([{
					method: "PUT",
					url: txn,
					parameters: { action: "UPDATE" },
					type: SPARQLUpdate,
					body: `drop silent graph <${g}>`
				}, {
					method: "PUT",
					url: txn,
					parameters: { action: "ADD", context: `<${g}>` },
					type: NTriples,
					body: expect.stringContaining(encoded)
				}]);

			});

			it("clears the default graph when storing no triples", async () => {

				const fetch = stub();

				await createRDF4JRepository({ server, repository, fetch }).execute(async client => {
					await client.store([]);
				});

				expect((await exchanges(fetch)).map(({ parameters, body }) => [parameters, body])).toEqual([
					[{ action: "UPDATE" }, "drop silent default"]
				]);

			});

			it("issues no exchange when merging no triples", async () => {

				const fetch = stub();

				await createRDF4JRepository({ server, repository, fetch }).execute(async client => {
					await client.merge([], g);
				});

				expect(await exchanges(fetch)).toEqual([]);

			});

			it("forwards settings to transaction writes", async () => {

				const fetch = stub();

				await createRDF4JRepository({ server, repository, infer: false, fetch }).execute(async client => {
					await client.merge(statements, g);
				});

				expect((await exchanges(fetch)).map(({ parameters }) => parameters)).toEqual([
					{ action: "ADD", context: `<${g}>`, infer: "false" }
				]);

			});

		});

	});

});
