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
 * {@link https://rdf4j.org/documentation/reference/rest-api/ RDF4J REST API} endpoint connector for the
 * {@link https://github.com/metreeca/wire @metreeca/wire} storage connector collection.
 *
 * Exposes any {@link https://rdf4j.org/ RDF4J Server} repository through the common {@link Repository} API,
 * bracketing each task in a server-managed transaction and applying optional inference and timeout settings.
 *
 * > [!IMPORTANT]
 * > **Transaction Isolation** — Determined by the target RDF4J repository.
 *
 * @module index
 *
 * @see {@link https://rdf4j.org/documentation/reference/rest-api/#transactions RDF4J REST API — Transactions}
 */

import { assert } from "@metreeca/core";
import { immutable } from "@metreeca/core/values";
import { resolve } from "@metreeca/core/resource";
import { createFetch } from "@metreeca/http";
import { type Problem, success } from "@metreeca/http/success";
import { transport } from "@metreeca/http/transport";
import { type Dataset, type Repository, SPARQLQuery, SPARQLUpdate } from "@metreeca/wire-sparql";
import { createHTTPRepository } from "@metreeca/wire-sparql-http";


/**
 * Names the SPARQL 1.1 Protocol parameters carrying a {@link Dataset}, forwarded onto the transaction endpoint.
 */
const DatasetParameters: ReadonlySet<string> = new Set([
	"default-graph-uri",
	"named-graph-uri",
	"using-graph-uri",
	"using-named-graph-uri"
]);


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Creates a {@link Repository} backed by an
 * {@link https://rdf4j.org/documentation/reference/rest-api/ RDF4J REST API} endpoint.
 *
 * Brackets every {@link Repository.execute | execute} task in a server-managed RDF4J transaction, committed when the
 * task completes and rolled back if it throws or any transactional operation fails.
 *
 * Operations issued **outside** an enclosing `execute` task are dispatched to the canonical SPARQL 1.1 Protocol
 * endpoints (`/repositories/{id}` for query, `/repositories/{id}/statements` for update) by delegating to a
 * {@link createHTTPRepository} instance, so a one-off `ask` / `update` does not pay the start-and-commit roundtrip
 * cost. A {@link Dataset} is honoured both inside and outside `execute` tasks, as the same protocol parameters.
 *
 * > [!IMPORTANT]
 * > **Transaction Isolation** — Determined by the target RDF4J repository.
 *
 * **Error handling** — every HTTP exchange is funnelled through {@link createFetch}, so:
 *
 * - Network failures (DNS, refused connection, TLS, abort) reject with a {@link Problem} carrying `status: 0`
 * - Non-2xx responses reject with a {@link Problem} carrying the wire status, the response `statusText` as `detail`,
 *   and the parsed body (RFC 7807 JSON, plain text, or omitted) as `report`
 * - Malformed JSON in a 2xx `ask`/`select` response rejects with a synthesised {@link Problem} carrying the response
 *   status and a parse-failure `detail`
 * - A 2xx `construct` response whose `Content-Type` is not N-Triples rejects with a synthesised {@link Problem}
 * - A missing `Location` header on the start-transaction response rejects with a synthesised {@link Problem}
 * - A malformed result payload surfaces the decoder's own error: a `SyntaxError` for ill-formed N-Triples, or a
 *   `RangeError` for a term component either syntax admits but the RDF data model rejects (a relative IRI, a lexical
 *   form holding an isolated surrogate, a non-conforming language tag), as well as for an unexpected SPARQL Results
 *   JSON term
 *
 * Rollback is best-effort: a network or 5xx failure on rollback is swallowed, so the original task error propagates.
 *
 * > [!WARNING]
 * > RDF4J Server does not apply `timeout` to updates issued within an {@link Repository.execute | execute} task,
 * > so they always run to completion. Aborting the exchange through a custom `fetch` does not stop them either: the
 * > update keeps running on the server, and the rollback waits for it to finish. Updates issued outside `execute`
 * > honour `timeout`, so an update that needs a time bound has to run there, giving up transactional atomicity.
 *
 * @param options - Server URL, repository identifier and the operation settings applied to every exchange
 * @param options.server - RDF4J Server base URL, for example `http://localhost:8080/rdf4j-server`
 * @param options.repository - Repository identifier within the RDF4J Server instance
 * @param options.infer - Whether operations take inferred statements into account; when omitted, RDF4J includes them
 * wherever the repository computes them, so set it to `false` to restrict operations to explicit statements
 * @param options.timeout - Maximum execution time of each operation, as a positive integer number of seconds; when
 * omitted, operations run under the execution limit configured on the server, if any
 * @param options.fetch - Custom `fetch` implementation used for every HTTP exchange, enabling header, auth, and
 * exchange customisation; defaults to the global `fetch`
 *
 * @returns A {@link Repository} instance
 *
 * @throws TypeError if `timeout` is not a positive integer
 *
 * @see {@link https://rdf4j.org/documentation/reference/rest-api/#transactions RDF4J REST API — Transactions}
 */
export function createRDF4JRepository({

	server,
	repository,

	infer,
	timeout,

	fetch = globalThis.fetch

}: {

	readonly server: string;
	readonly repository: string;

	readonly infer?: boolean;
	readonly timeout?: number;

	readonly fetch?: typeof globalThis.fetch;

}): Repository {

	const $timeout = assert(timeout, timeout => timeout === undefined || Number.isInteger(timeout) && timeout > 0,
		`expected positive integer timeout <${timeout}>`
	);

	const settings = new URLSearchParams([
		...infer === undefined ? [] : [["infer", String(infer)]],
		...$timeout === undefined ? [] : [["timeout", String($timeout)]]
	]).toString();

	const remote = createFetch(success(), transport(fetch));

	const query = `${server}/repositories/${repository}`;
	const update = `${query}/statements`;
	const txns = `${query}/transactions`;

	return immutable({

		...createHTTPRepository({ query: configure(query), update: configure(update), fetch }),

		async execute(task) {

			const response = await remote(txns, { method: "POST" });
			const location = response.headers.get("Location");

			if ( location === null ) {
				throw immutable<Problem>({
					status: response.status,
					detail: `missing <Location> header in response to POST <${txns}>`
				});
			}

			const txn = resolve(txns, location);

			// transaction-scoped repository: an ordinary SPARQL-over-HTTP repository whose every exchange is
			// retargeted onto the RDF4J transaction endpoint (`PUT <txn>?action=…`) by the transact() fetch wrapper

			const scoped = createHTTPRepository({ query: txn, update: txn, fetch: transact(txn) });

			try {

				const value = await task(scoped);

				await remote(`${txn}?action=COMMIT`, { method: "PUT" });

				return value;

			} catch ( e ) { // best-effort rollback — see TSDoc; swallow rollback errors so the task error propagates

				await remote(txn, { method: "DELETE" }).catch(() => undefined);

				throw e;

			}

		}

	});


	/**
	 * Applies the configured operation settings to an RDF4J endpoint.
	 *
	 * @param url - Endpoint URL, possibly already carrying URL parameters
	 *
	 * @returns `url` extended with the `infer` and `timeout` parameters, or `url` itself when none is configured
	 */
	function configure(url: string): string {

		return settings === "" ? url : `${url}${url.includes("?") ? "&" : "?"}${settings}`;

	}

	/**
	 * Builds a {@link fetch} that retargets SPARQL-over-HTTP exchanges onto an open RDF4J transaction.
	 *
	 * The returned fetch rewrites every exchange to `PUT <txn>?action=…` with the configured operation settings,
	 * deriving the action from the request {@link operation} and lifting the SPARQL text into the PUT body so the
	 * mapping is independent of how the originating exchange was transmitted. The `Accept` header is forwarded so
	 * response negotiation (SPARQL Results JSON for `ask` and `select`, N-Triples for `construct`) is preserved.
	 *
	 * @param txn - Transaction endpoint URL from the start-transaction `Location` header
	 *
	 * @returns A {@link fetch} issuing every call as an operation against the transaction `txn`
	 */
	function transact(txn: string): typeof globalThis.fetch {

		return async (input, init) => {

			const request = new Request(input, init);

			const { action, sparql } = await operation(request);

			const contentType = action === "UPDATE" ? SPARQLUpdate : SPARQLQuery;
			const accept = request.headers.get("Accept");

			const dataset = [...new URL(request.url).searchParams].filter(([name]) => DatasetParameters.has(name));

			return fetch(configure(`${txn}?${new URLSearchParams([["action", action], ...dataset])}`), {
				method: "PUT",
				headers: accept === null
					? { "Content-Type": contentType }
					: { "Content-Type": contentType, "Accept": accept },
				body: sparql
			});

		};

	}

	/**
	 * Extracts the SPARQL operation carried by a SPARQL 1.1 Protocol request.
	 *
	 * Normalises the three protocol request encodings into a uniform action/text pair: query-via-GET (SPARQL in the
	 * `query` URL parameter; GET never carries updates), URL-encoded form POST (SPARQL in the `query` or `update`
	 * field, whose name selects the action), and direct POST (SPARQL verbatim in the body, with the action on the
	 * `Content-Type`). A request carrying no SPARQL decodes to an empty `sparql` string.
	 *
	 * @param request - Originating SPARQL-over-HTTP request
	 *
	 * @returns The decoded operation: its `action` (`QUERY` or `UPDATE`) and the extracted `sparql` text
	 */
	async function operation(request: Request): Promise<{

		readonly action: "QUERY" | "UPDATE";
		readonly sparql: string

	}> {

		const contentType = request.headers.get("Content-Type") ?? "";

		if ( request.method === "GET" ) {

			// query-via-GET: SPARQL in the `query` parameter; GET never carries updates

			return { action: "QUERY", sparql: new URL(request.url).searchParams.get("query") ?? "" };

		} else if ( contentType.startsWith("application/x-www-form-urlencoded") ) {

			// URL-encoded POST: SPARQL in the `query` or `update` field, whose name carries the operation

			const form = new URLSearchParams(await request.text());
			const update = form.get("update");

			return update !== null
				? { action: "UPDATE", sparql: update }
				: { action: "QUERY", sparql: form.get("query") ?? "" };

		} else {

			// direct POST: SPARQL travels verbatim in the body, with the operation on the Content-Type

			const sparql = await request.text();

			return contentType === SPARQLUpdate
				? { action: "UPDATE", sparql }
				: { action: "QUERY", sparql };

		}

	}

}
