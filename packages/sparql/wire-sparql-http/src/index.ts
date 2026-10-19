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

/**
 * {@link https://www.w3.org/TR/sparql11-protocol/ SPARQL 1.1 Protocol} endpoint connector for the
 * {@link https://github.com/metreeca/wire @metreeca/wire} storage connector collection.
 *
 * Exposes any SPARQL 1.1 Protocol compliant endpoint through the common {@link Repository} API.
 *
 * > [!IMPORTANT]
 * > **Transaction Isolation** — None. The SPARQL 1.1 Protocol exposes no transaction primitives.
 *
 * @module index
 *
 * @see {@link https://www.w3.org/TR/sparql11-protocol/ SPARQL 1.1 Protocol}
 */

import { isError } from "@metreeca/core";
import { type IRI } from "@metreeca/core/resource";
import { immutable } from "@metreeca/core/values";
import { createFetch } from "@metreeca/http";
import { type Problem, success } from "@metreeca/http/success";
import { transport } from "@metreeca/http/transport";
import { type Triple } from "@metreeca/trio";
import { decodeNTriples, encodeNTriples, NTriples } from "@metreeca/trio/ntriples";
import {
	type Dataset,
	type Repository,
	type SPARQL,
	SPARQLQuery,
	SPARQLResults,
	SPARQLUpdate
} from "@metreeca/wire-sparql";
import { data, drop, graph, insert, reference, silent, triples, update } from "@metreeca/wire-sparql/builder";
import { decodeTuples, type SPARQLBindings, type SPARQLBoolean } from "./index.core.js";


/**
 * Creates an HTTP-based {@link Repository} backed by a
 * {@link https://www.w3.org/TR/sparql11-protocol/ SPARQL 1.1 Protocol} endpoint.
 *
 * Each query and update is dispatched eagerly as a single HTTP request. A {@link Dataset} is sent as protocol
 * parameters added to any the endpoint URL already carries: `default-graph-uri` and `named-graph-uri` on queries,
 * `using-graph-uri` and `using-named-graph-uri` on updates. An endpoint rejecting an update that declares its own
 * dataset as well fails like any other non-2xx response, rejecting with a {@link Problem} carrying the wire status.
 *
 * {@link Repository.merge | merge} and {@link Repository.store | store} upload their triples as N-Triples to the
 * Graph Store Protocol endpoint, when one is configured. Without one, they run as `INSERT DATA` updates on the update
 * endpoint, preceded by `DROP SILENT` for `store`. Every SPARQL 1.1 Protocol endpoint supports this fallback, at the
 * price of parsing the data as SPARQL text. A `merge` of no triples issues no request to either endpoint.
 *
 * > [!IMPORTANT]
 * > **Transaction Isolation** — None. The SPARQL 1.1 Protocol exposes no transaction primitives.
 *
 * **Error handling** — every HTTP exchange is funnelled through {@link createFetch}, so:
 *
 * - Network failures (DNS, refused connection, TLS, abort) reject with a {@link Problem} carrying `status: 0`
 * - Non-2xx responses reject with a {@link Problem} carrying the wire status, the response `statusText` as `detail`,
 *   and the parsed body (RFC 7807 JSON, plain text, or omitted) as `report`
 * - Malformed JSON in a 2xx `ask`/`select` response rejects with a synthesised {@link Problem} carrying the response
 *   status and a parse-failure `detail`
 * - A 2xx `construct` response whose `Content-Type` is not N-Triples rejects with a synthesised {@link Problem}
 * - A malformed result payload surfaces the decoder's own error: a `SyntaxError` for ill-formed N-Triples, or a
 *   `RangeError` for a term component either syntax admits but the RDF data model rejects (a relative IRI, a lexical
 *   form holding an isolated surrogate, a non-conforming language tag), as well as for an unrecognised SPARQL Results
 *   JSON binding
 *
 * @param options - Endpoint URLs and the optional `fetch` override
 * @param options.query - SPARQL query endpoint URL, for example `http://localhost:7200/repositories/my-repo`
 * @param options.update - SPARQL update endpoint URL; defaults to `query` when omitted
 * @param options.graphs - Graph Store Protocol endpoint URL, for example
 * `http://localhost:7200/repositories/my-repo/rdf-graphs/service`; when omitted, graph store writes run as SPARQL
 * updates on the `update` endpoint, with the same effect on the store but no bulk upload of the data
 * @param options.fetch - Custom `fetch` implementation used for every HTTP exchange, enabling header, auth, and
 * exchange customisation; defaults to the global `fetch`
 *
 * @returns An immutable {@link Repository} backed by the configured endpoints
 */
export function createHTTPRepository({

	query: queryURL,

	update: updateURL = queryURL,
	graphs: graphsURL,

	fetch = globalThis.fetch

}: {

	readonly query: string;

	readonly update?: string;
	readonly graphs?: string;

	readonly fetch?: typeof globalThis.fetch;

}): Repository {

	const remote = createFetch(success(), transport(fetch));


	const repository: Repository = immutable({

		async ask(query, dataset) {

			const result = await json<SPARQLBoolean>(
				await post(queries(dataset), SPARQLQuery, query, SPARQLResults)
			);

			return result.boolean;

		},

		async select(query, dataset) {

			return decodeTuples(await json<SPARQLBindings>(
				await post(queries(dataset), SPARQLQuery, query, SPARQLResults)
			));

		},

		async construct(query, dataset) {

			const response = await post(queries(dataset), SPARQLQuery, query, NTriples);
			const contentType = response.headers.get("Content-Type") ?? "";

			if ( contentType.startsWith(NTriples) ) {

				return decodeNTriples(await response.text());

			} else {

				throw immutable<Problem>({
					status: response.status,
					detail: `unsupported response Content-Type <${contentType}> from <${response.url}>`
				});

			}

		},

		update(update, dataset) {

			return post(updates(dataset), SPARQLUpdate, update);

		},

		merge(triples, graph) {

			return triples.length === 0 ? Promise.resolve()
				: graphsURL === undefined ? post(updateURL, SPARQLUpdate, inserting(triples, graph))
					: upload(graphsURL, "POST", triples, graph);

		},

		store(triples, graph) {

			return graphsURL === undefined ? post(updateURL, SPARQLUpdate, storing(triples, graph))
				: upload(graphsURL, "PUT", triples, graph);

		},

		execute<V>(task: (repository: Repository) => V | Promise<V>): Promise<V> {

			return Promise.resolve(task(repository)); // no transaction support, run the task directly

		},

		close() {

			return Promise.resolve();

		}

	});

	return repository;


	/**
	 * Targets the query endpoint at a dataset, as the `default-graph-uri` and `named-graph-uri` parameters.
	 */
	function queries(dataset: Dataset = {}): string {
		return target(queryURL, [
			...(dataset.default ?? []).map(iri => ["default-graph-uri", iri]),
			...(dataset.named ?? []).map(iri => ["named-graph-uri", iri])
		]);
	}

	/**
	 * Targets the update endpoint at a dataset, as the `using-graph-uri` and `using-named-graph-uri` parameters.
	 */
	function updates(dataset: Dataset = {}): string {
		return target(updateURL, [
			...(dataset.default ?? []).map(iri => ["using-graph-uri", iri]),
			...(dataset.named ?? []).map(iri => ["using-named-graph-uri", iri])
		]);
	}

	/**
	 * Extends an endpoint URL, possibly already carrying URL parameters, with further parameters.
	 */
	function target(url: string, parameters: readonly string[][]): string {
		return parameters.length === 0 ? url
			: `${url}${url.includes("?") ? "&" : "?"}${new URLSearchParams([...parameters])}`;
	}

	/**
	 * Renders a graph store merge as an `INSERT DATA` update.
	 */
	function inserting(statements: readonly Triple[], target?: IRI): SPARQL {
		return update(insert(data(target === undefined
			? triples(statements)
			: graph(reference(target), triples(statements))
		)));
	}

	/**
	 * Renders a graph store replacement as a `DROP SILENT` update followed by an `INSERT DATA` one.
	 */
	function storing(statements: readonly Triple[], target?: IRI): SPARQL {
		return update(silent(drop(target ?? "default")), inserting(statements, target));
	}

	/**
	 * Uploads triples as N-Triples to a Graph Store Protocol endpoint, identifying the target graph indirectly.
	 */
	async function upload(
		url: string, method: "POST" | "PUT", statements: readonly Triple[], target?: IRI
	): Promise<void> {

		await remote(`${url}${url.includes("?") ? "&" : "?"}${target === undefined
			? "default"
			: new URLSearchParams([["graph", target]])
		}`, {

			method,

			headers: { "Content-Type": NTriples },

			body: encodeNTriples(statements)

		});

	}

	async function post(url: string, contentType: string, body: SPARQL): Promise<void>;
	async function post(url: string, contentType: string, body: SPARQL, accept: string): Promise<Response>;
	async function post(url: string, contentType: string, body: SPARQL, accept?: string): Promise<Response | void> {

		const response = await remote(url, {

			method: "POST",

			headers: accept === undefined
				? { "Content-Type": contentType }
				: { "Content-Type": contentType, "Accept": accept },

			body

		});

		if ( accept !== undefined ) {

			return response;

		}

	}

	async function json<V>(response: Response): Promise<V> {

		try {

			return await response.json();

		} catch ( e ) {

			throw immutable<Problem>({
				status: response.status,
				detail: `malformed JSON response from <${response.url}>: ${isError(e) ? e.message : String(e)}`
			});

		}

	}

}
