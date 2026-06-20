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

import { immutable } from "@metreeca/core/deep";
import { createFetch, type Problem } from "@metreeca/core/problem";
import { message } from "@metreeca/core/report";
import { media, type Repository, type SPARQL } from "@metreeca/wire-sparql";
import { decodeNTriples } from "@metreeca/wire-sparql/codecs/ntriples";
import { decodeTuples, type SPARQLBindings, type SPARQLBoolean } from "./index.core.js";


/**
 * Creates an HTTP-based {@link Repository} backed by a
 * {@link https://www.w3.org/TR/sparql11-protocol/ SPARQL 1.1 Protocol} endpoint.
 *
 * Each query and update is dispatched eagerly as a single HTTP request.
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
 *   `RangeError` for a malformed or unrecognised SPARQL Results JSON binding
 *
 * @param options - Endpoint URLs and the optional `fetch` override
 * @param options.query - SPARQL query endpoint URL, for example `http://localhost:7200/repositories/my-repo`
 * @param options.update - SPARQL update endpoint URL; defaults to `query` when omitted
 * @param options.fetch - Custom `fetch` implementation used for every HTTP exchange, enabling header, auth, and
 * exchange customisation; defaults to the global `fetch`
 *
 * @returns An immutable {@link Repository} backed by the configured endpoints
 */
export function createHTTPRepository({

	query: queryURL,
	update: updateURL = queryURL,

	fetch = globalThis.fetch

}: {

	readonly query: string;
	readonly update?: string;

	readonly fetch?: typeof globalThis.fetch;

}): Repository {

	const remote = createFetch(fetch);


	const repository: Repository = immutable({

		async ask(query) {

			const result = await json<SPARQLBoolean>(
				await post(queryURL, media.query, query, media.results)
			);

			return result.boolean;

		},

		async select(query) {

			return decodeTuples(await json<SPARQLBindings>(
				await post(queryURL, media.query, query, media.results)
			));

		},

		async construct(query) {

			const response = await post(queryURL, media.query, query, media.ntriples);
			const contentType = response.headers.get("Content-Type") ?? "";

			if ( contentType.startsWith(media.ntriples) ) {

				return decodeNTriples(await response.text());

			} else {

				throw immutable<Problem>({
					status: response.status,
					detail: `unsupported response Content-Type <${contentType}> from <${response.url}>`
				});

			}

		},

		update(update) {

			return post(updateURL, media.update, update);

		},

		execute<V>(task: (repository: Repository) => V | Promise<V>): Promise<V> {

			return Promise.resolve(task(repository)); // no transaction support, run the task directly

		},

		close() {

			return Promise.resolve();

		}

	});

	return repository;


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
				detail: `malformed JSON response from <${response.url}>: ${message(e)}`
			});

		}

	}

}
