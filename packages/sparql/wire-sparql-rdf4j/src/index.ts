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
 * bracketing each task in a server-managed transaction.
 *
 * > [!IMPORTANT]
 * > **Transaction Isolation** — Determined by the target RDF4J repository.
 *
 * @module index
 *
 * @see {@link https://rdf4j.org/documentation/reference/rest-api/#transactions RDF4J REST API — Transactions}
 */

import { immutable } from "@metreeca/core/deep";
import { createFetch, type Problem } from "@metreeca/core/problem";
import { resolve } from "@metreeca/core/resource";
import { media, type Repository } from "@metreeca/wire-sparql";
import { createHTTPRepository } from "@metreeca/wire-sparql-http";


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
 * cost.
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
 *   `RangeError` for an unexpected SPARQL Results JSON term
 *
 * Rollback (`DELETE` on the transaction URL) is best-effort: a network or 5xx failure on rollback
 * is swallowed so the original task error propagates; without best-effort handling a transient
 * network glitch on the rollback would mask the real cause of the task failure.
 *
 * @param options - Server URL and repository identifier
 * @param options.server - RDF4J Server base URL, for example `http://localhost:8080/rdf4j-server`
 * @param options.repository - Repository identifier within the RDF4J Server instance
 * @param options.fetch - Custom `fetch` implementation used for every HTTP exchange, enabling header, auth, and
 * exchange customisation; defaults to the global `fetch`
 *
 * @returns A {@link Repository} instance
 *
 * @see {@link https://rdf4j.org/documentation/reference/rest-api/#transactions RDF4J REST API — Transactions}
 */
export function createRDF4JRepository({

	server,
	repository,

	fetch = globalThis.fetch

}: {

	readonly server: string;
	readonly repository: string;

	readonly fetch?: typeof globalThis.fetch;

}): Repository {

	const remote = createFetch(fetch);

	const query = `${server}/repositories/${repository}`;
	const update = `${query}/statements`;
	const txns = `${query}/transactions`;

	return immutable({

		...createHTTPRepository({ query, update, fetch }),

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
	 * Builds a {@link fetch} that retargets SPARQL-over-HTTP exchanges onto an open RDF4J transaction.
	 *
	 * The returned fetch rewrites every exchange to `PUT <txn>?action=…`, deriving the action from the request
	 * {@link operation} and lifting the SPARQL text into the PUT body so the mapping is independent of how the
	 * originating exchange was transmitted. The `Accept` header is forwarded so response negotiation (SPARQL Results
	 * JSON for `ask` and `select`, N-Triples for `construct`) is preserved.
	 *
	 * @param txn - Transaction endpoint URL from the start-transaction `Location` header
	 *
	 * @returns A {@link fetch} issuing every call as an operation against the transaction `txn`
	 */
	function transact(txn: string): typeof globalThis.fetch {

		return async (input, init) => {

			const request = new Request(input, init);

			const { action, sparql } = await operation(request);

			const contentType = action === "UPDATE" ? media.update : media.query;
			const accept = request.headers.get("Accept");

			return fetch(`${txn}?action=${action}`, {
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

			return contentType === media.update
				? { action: "UPDATE", sparql }
				: { action: "QUERY", sparql };

		}

	}

}
