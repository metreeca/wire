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

import { SPARQLResults } from "@metreeca/wire-sparql";
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

});
