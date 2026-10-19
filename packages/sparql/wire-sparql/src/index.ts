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
 * SPARQL repository API and data model.
 *
 * Provides a single, backend-independent API for working with SPARQL stores. Consumers query and write them through
 * the {@link Repository} interface and exchange data as the SPARQL types defined here, layered on the RDF terms and
 * statements of {@link https://metreeca.github.io/trio/ @metreeca/trio}, regardless of which connector backs the store.
 *
 * **Media types**
 *
 * - {@link SPARQLQuery} — IANA media type for SPARQL query requests
 * - {@link SPARQLUpdate} — IANA media type for SPARQL update requests
 * - {@link SPARQLResults} — IANA media type for SPARQL query results in JSON
 *
 * **Repository**
 *
 * - {@link Repository} — a {@link RepositoryClient} with transactional `execute` and lifecycle `close`
 * - {@link RepositoryClient} — operations on an RDF store: `ask`/`select`/`construct`, `update` and `merge`/`store`
 *
 * **Data model**
 *
 * - {@link SPARQL} — query, update, or syntactic fragment as serialised text
 * - {@link Dataset} — RDF dataset overriding the one declared by a query or update
 * - {@link Tuple} — `SELECT` query-solution mapping
 * - {@link Pattern} — triple pattern admitting {@link Variable | variables}
 * - {@link Variable} — allocated `?`-prefixed SPARQL variable
 *
 * **Factories**
 *
 * - {@link sparql} — mark a string or a template literal as {@link SPARQL} text
 * - {@link tuple} — construct a {@link Tuple}
 * - {@link pattern} — construct a {@link Pattern}
 * - {@link variable} — construct a {@link Variable}
 *
 * **Wrappers**
 *
 * - {@link createBufferingRepository} — wrap a {@link Repository} to batch a transaction's writes into few requests
 * - {@link createLoggingRepository} — wrap a {@link Repository} to log each operation and its elapsed time
 *
 * @module index
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/ SPARQL 1.1 Query Language}
 * @see {@link https://www.w3.org/TR/sparql11-update/ SPARQL 1.1 Update}
 * @see {@link https://www.w3.org/TR/rdf11-concepts/ RDF 1.1 Concepts and Abstract Syntax}
 */

import { error, isNumber, isString } from "@metreeca/core";
import { type IRI } from "@metreeca/core/resource";
import { dedent } from "@metreeca/core/strings";
import { equals, immutable } from "@metreeca/core/values";
import { type Predicate, type Subject, type Term, type Triple } from "@metreeca/trio";
import { update } from "./builder.js";


/**
 * Matches the `PN_CHARS_BASE` production, as a character-class body.
 *
 * The supplementary range U+10000–U+EFFFF is written as a code-point escape, so every pattern embedding this fragment
 * requires the `u` flag.
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#rPN_CHARS_BASE SPARQL 1.1 §19.8 — PN_CHARS_BASE}
 */
const PN_CHARS_BASE =
	String.raw`A-Za-z\u{00C0}-\u{00D6}\u{00D8}-\u{00F6}\u{00F8}-\u{02FF}\u{0370}-\u{037D}`
	+String.raw`\u{037F}-\u{1FFF}\u{200C}-\u{200D}\u{2070}-\u{218F}\u{2C00}-\u{2FEF}\u{3001}-\u{D7FF}`
	+String.raw`\u{F900}-\u{FDCF}\u{FDF0}-\u{FFFD}\u{10000}-\u{EFFFF}`;

/**
 * Matches the `PN_CHARS_U` production, as a character-class body.
 *
 * Extends {@link PN_CHARS_BASE} with `_`.
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#rPN_CHARS_U SPARQL 1.1 §19.8 — PN_CHARS_U}
 */
const PN_CHARS_U =
	String.raw`${PN_CHARS_BASE}_`;

/**
 * Matches a variable name, as an unanchored regex source fragment.
 *
 * Enforces the `VARNAME` production, bare of its `?`/`$` marker: a leading `PN_CHARS_U` or digit, so that the numeric
 * names the wire uses (`0`, `1`, …) are admitted alongside identifier-like ones, then any run of those same characters
 * extended with the middle dot and the combining and connector marks. `-` and `.` are excluded throughout, unlike in
 * the `PN_CHARS` production the RDF term grammars build on, as is every delimiter. Embedding patterns must carry the
 * `u` flag, as required by the code-point escapes in {@link PN_CHARS_BASE}.
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#rVARNAME SPARQL 1.1 §19.8 — VARNAME}
 */
const VARNAME =
	String.raw`[${PN_CHARS_U}0-9]`
	+String.raw`[${PN_CHARS_U}0-9\u{00B7}\u{0300}-\u{036F}\u{203F}-\u{2040}]*`;


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Matches a well-formed string {@link Variable} name.
 *
 * Anchors {@link VARNAME} to the whole string, as the name validation performed by {@link variable} requires.
 */
const VariablePattern = new RegExp(`^${VARNAME}$`, "u");


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * IANA media type for SPARQL query requests.
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#mediaType SPARQL 1.1 Query Language §22 — Internet Media Type,
 * 		File Extension and Macintosh File Type}
 * @see {@link https://www.w3.org/TR/sparql11-protocol/#query-bindings-http SPARQL 1.1 Protocol — Query Operation}
 */
export const SPARQLQuery = "application/sparql-query";

/**
 * IANA media type for SPARQL update requests.
 *
 * @see {@link https://www.w3.org/TR/sparql11-update/#mediaType SPARQL 1.1 Update §B — Internet Media Type, File
 * 		Extension and Macintosh File Type}
 * @see {@link https://www.w3.org/TR/sparql11-protocol/#update-bindings-http SPARQL 1.1 Protocol — Update Operation}
 */
export const SPARQLUpdate = "application/sparql-update";

/**
 * IANA media type for SPARQL query results in JSON.
 *
 * @see {@link https://www.w3.org/TR/sparql11-results-json/#content-type SPARQL 1.1 Query Results JSON Format §6 —
 * 		Internet Media Type, File Extension and Macintosh File Type}
 */
export const SPARQLResults = "application/sparql-results+json";


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * SPARQL repository.
 *
 * The interface connector packages implement to expose a concrete SPARQL backend. Extends the {@link RepositoryClient}
 * query and update surface with transactional {@link Repository.execute | execute} and lifecycle
 * {@link Repository.close | close}.
 *
 * > [!IMPORTANT]
 * > {@link Repository.execute | execute} provides best-effort transaction isolation: snapshot isolation where the
 * > backend supports it, degrading to the maximum level the storage achieves, down to none.
 *
 * > [!IMPORTANT]
 * > Each implementation **must** declare its supported isolation level in its factory documentation.
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/ SPARQL 1.1 Query Language}
 * @see {@link https://www.w3.org/TR/sparql11-update/ SPARQL 1.1 Update}
 */
export interface Repository extends RepositoryClient {

	/**
	 * Execute a task within a repository transaction.
	 *
	 * The task receives a per-call {@link RepositoryClient} bound to a transaction; updates and graph store writes
	 * issued through it are applied within the transaction in order. If the task completes, the transaction commits; if
	 * it throws or rejects, the transaction rolls back and the error propagates to the caller as a promise rejection.
	 * Concurrent top-level `execute` calls run in independent transactions and never share state.
	 *
	 * > [!IMPORTANT]
	 * > Every implementation must provide `execute`, but its guarantees are backend-dependent. A backend with native
	 * > transactions brackets the task for atomic commit and rollback. A backend without one supplies a degenerate
	 * > implementation: the task runs directly against this same {@link Repository}, with no atomicity and no
	 * > rollback. Either way, each implementation declares the isolation level it provides in its own factory
	 * > documentation.
	 *
	 * > [!WARNING]
	 * > `execute` is not re-entrant: while a task is running, it MUST NOT start another transaction by calling
	 * > `execute` again on the same repository. Transactions do not nest, so all operations that must commit together
	 * > have to run within a single `execute` call.
	 *
	 * > [!WARNING]
	 * > The task MUST NOT retain or use the {@link RepositoryClient} it receives after `execute` settles:
	 * > implementations may back it with transaction-scoped state (buffered mutations, a bound backend scope) that is
	 * > flushed or discarded on completion, so any later call has undefined behaviour.
	 *
	 * @typeParam V - Return type of the task
	 *
	 * @param task - Async or sync function performing SPARQL operations on the per-call {@link RepositoryClient}
	 *
	 * @returns A promise resolving to the value returned by `task`; rejects with a
	 * {@link @metreeca/core!Problem | Problem} if a transaction, network, storage, or other processing error occurs
	 */
	execute<V>(task: (repository: RepositoryClient) => V | Promise<V>): Promise<V>;

	/**
	 * Release resources held by this repository.
	 *
	 * Frees underlying resources such as database connections or file handles. Calling `close` on an
	 * already-closed repository has no effect.
	 *
	 * > [!IMPORTANT]
	 * > Every implementation must provide `close`, but it is degenerate where there is nothing to release: a backend
	 * > that holds no resources implements it as a resolved no-op.
	 *
	 * > [!WARNING]
	 * > Callers MUST NOT use the repository after `close` settles: `ask`, `select`, `construct`, `update`, `merge`,
	 * > `store` and `execute` all have undefined behaviour once the underlying resources are released.
	 *
	 * @returns A promise resolving when all resources have been released; rejects with a
	 * {@link @metreeca/core!Problem | Problem} if a clean-up error occurs
	 */
	close(): Promise<void>;

}

/**
 * SPARQL repository query, update and graph store operations.
 *
 * Groups the core operations: `ask`, `select`, and `construct` read from the backing RDF store, `update` writes to it
 * through SPARQL Update requests, and `merge` and `store` write RDF data into a graph without going through SPARQL
 * text. {@link Repository} extends this surface for standalone use; the same operations are also handed to a task as
 * the per-call client inside {@link Repository.execute | execute}, where they run within the enclosing transaction.
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/ SPARQL 1.1 Query Language}
 * @see {@link https://www.w3.org/TR/sparql11-update/ SPARQL 1.1 Update}
 * @see {@link https://www.w3.org/TR/sparql11-http-rdf-update/ SPARQL 1.1 Graph Store HTTP Protocol}
 */
export interface RepositoryClient {

	/**
	 * Execute an ASK query.
	 *
	 * @param query - The SPARQL ASK query
	 * @param dataset - The {@link Dataset} to query, overriding the `FROM` and `FROM NAMED` clauses of `query`; when
	 * 		omitted, `query` runs against the dataset it declares, or against the default dataset of the backend
	 *
	 * @returns A promise resolving to the boolean query result
	 */
	ask(query: SPARQL, dataset?: Dataset): Promise<boolean>;

	/**
	 * Execute a SELECT query.
	 *
	 * @param query - The SPARQL SELECT query
	 * @param dataset - The {@link Dataset} to query, overriding the `FROM` and `FROM NAMED` clauses of `query`; when
	 * 		omitted, `query` runs against the dataset it declares, or against the default dataset of the backend
	 *
	 * @returns A promise resolving to the solution {@link Tuple | tuples}, in solution-sequence order
	 */
	select(query: SPARQL, dataset?: Dataset): Promise<readonly Tuple[]>;

	/**
	 * Execute a CONSTRUCT query.
	 *
	 * @param query - The SPARQL CONSTRUCT query
	 * @param dataset - The {@link Dataset} to query, overriding the `FROM` and `FROM NAMED` clauses of `query`; when
	 * 		omitted, `query` runs against the dataset it declares, or against the default dataset of the backend
	 *
	 * @returns A promise resolving to the constructed RDF {@link Triple | triples}
	 */
	construct(query: SPARQL, dataset?: Dataset): Promise<readonly Triple[]>;


	/**
	 * Execute a SPARQL UPDATE operation.
	 *
	 * > [!WARNING]
	 * > A `dataset` is admitted only for updates declaring none of their own: SPARQL 1.1 Protocol forbids combining it
	 * > with `USING`, `USING NAMED` or `WITH` clauses, and the backend rejects such a request with its own error.
	 *
	 * @param update - The SPARQL UPDATE request
	 * @param dataset - The {@link Dataset} matched by the `WHERE` clauses of `update`; when omitted, `update` runs
	 * 		against the dataset it declares, or against the default dataset of the backend
	 *
	 * @see {@link https://www.w3.org/TR/sparql11-protocol/#update-dataset SPARQL 1.1 Protocol §2.2.3 — Specifying
	 * 		an RDF Dataset}
	 */
	update(update: SPARQL, dataset?: Dataset): Promise<void>;


	/**
	 * Merge triples into a graph.
	 *
	 * Adds `triples` to the graph content, keeping the statements already there. Blank nodes in `triples` are kept
	 * apart from those already in the store, as in an `INSERT DATA` update, so they never correlate with existing
	 * nodes. Merging an empty array leaves the store unchanged, creating no named graph either.
	 *
	 * @param triples - The RDF {@link Triple | triples} to add
	 * @param graph - The IRI of the target named graph, created if missing; when omitted, the default graph
	 *
	 * @see {@link https://www.w3.org/TR/sparql11-http-rdf-update/#http-post SPARQL 1.1 Graph Store Protocol §5.5 —
	 * 		HTTP POST}
	 */
	merge(triples: readonly Triple[], graph?: IRI): Promise<void>;

	/**
	 * Store triples as the content of a graph.
	 *
	 * Replaces the graph content with `triples`, discarding the statements already there. Blank nodes in `triples` are
	 * kept apart from those already in the store, as in {@link RepositoryClient.merge | merge}. Storing an empty array
	 * leaves the graph empty, while the other graphs of the store are never affected.
	 *
	 * @param triples - The RDF {@link Triple | triples} making up the new graph content
	 * @param graph - The IRI of the target named graph, created if missing; when omitted, the default graph
	 *
	 * @see {@link https://www.w3.org/TR/sparql11-http-rdf-update/#http-put SPARQL 1.1 Graph Store Protocol §5.3 —
	 * 		HTTP PUT}
	 */
	store(triples: readonly Triple[], graph?: IRI): Promise<void>;

}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * A SPARQL query, update, or syntactic fragment as serialised text.
 *
 * The wire format for {@link Repository} I/O: complete queries and updates exchanged with the backend, and partial
 * fragments (triple patterns, graph patterns, projections, filters, …) composed into them. Pass a string to
 * {@link sparql}, or tag a template literal with it, to mark its content as SPARQL text.
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/ SPARQL 1.1 Query Language}
 * @see {@link https://www.w3.org/TR/sparql11-update/ SPARQL 1.1 Update}
 */
export type SPARQL = string

/**
 * A SPARQL RDF dataset.
 *
 * Names the graphs an operation runs against, overriding the dataset declared by the request text. A dataset that
 * lists no graphs in either property leaves the request's own dataset in effect.
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#rdfDataset SPARQL 1.1 Query §13 — RDF Dataset}
 * @see {@link https://www.w3.org/TR/sparql11-protocol/#dataset SPARQL 1.1 Protocol §2.1.4 — Specifying an RDF Dataset}
 */
export type Dataset = {

	/**
	 * The graphs merged into the default graph; if omitted while `named` lists graphs, the default graph is empty.
	 */
	readonly default?: readonly IRI[];

	/**
	 * The graphs available as named graphs; if omitted while `default` lists graphs, there are no named graphs.
	 */
	readonly named?: readonly IRI[];

};

/**
 * A SPARQL query-solution mapping.
 *
 * Maps each projected {@link Variable} token to the RDF {@link Term} bound by the solution. Returned by
 * {@link RepositoryClient.select | `RepositoryClient.select`} in solution-sequence order. Construct one with
 * {@link tuple}.
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#sparqlSolutions SPARQL 1.1 Query Solutions}
 */
export type Tuple = {

	readonly [variable: Variable]: Term

};

/**
 * A SPARQL triple pattern.
 *
 * A {@link Triple} whose positions also admit a {@link Variable}, as constructed by {@link pattern}.
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#QSynTriples SPARQL 1.1 Triple Patterns}
 */
export type Pattern = readonly [
		Variable | Subject,
		Variable | Predicate,
		Variable | Term
];

/**
 * A SPARQL variable.
 *
 * A `?`-prefixed token, for example `?0` or `?name`, whose body names the variable. The value is its own SPARQL
 * rendering, so it doubles as a {@link Tuple} key and as the query-text token emitted by the `builder` module. Mint
 * one with {@link variable}.
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#QSynVariables SPARQL 1.1 Variables}
 */
export type Variable =
	| `?${string}`


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Marks a string as {@link SPARQL} text.
 *
 * Marks the string as SPARQL, recording at the definition site that its content is query, update, or fragment source,
 * so that editors and other tools handle it accordingly.
 *
 * The text is realigned as {@link dedent} does, so SPARQL laid out to match the indentation of the surrounding code
 * reads as if written flush left.
 *
 * @param text - The SPARQL text
 *
 * @returns A copy of `text`, with the shared leading whitespace removed from every line
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/ SPARQL 1.1 Query Language}
 * @see {@link https://www.w3.org/TR/sparql11-update/ SPARQL 1.1 Update}
 */
export function sparql(text: string): SPARQL;

/**
 * Tags a template literal as {@link SPARQL} text.
 *
 * Marks the literal as SPARQL, recording at the definition site that its content is query, update, or fragment source,
 * so that editors and other tools handle it accordingly.
 *
 * The literal is realigned as {@link dedent} does, so SPARQL laid out to match the indentation of the surrounding code
 * reads as if written flush left.
 *
 * @param template - The literal sections of the SPARQL text
 * @param values - The values interpolated between the literal sections
 *
 * @returns The assembled template, with the shared leading whitespace removed from every line
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/ SPARQL 1.1 Query Language}
 * @see {@link https://www.w3.org/TR/sparql11-update/ SPARQL 1.1 Update}
 */
export function sparql(template: TemplateStringsArray, ...values: unknown[]): SPARQL;

/**
 * Marks a string or a template literal as {@link SPARQL} text.
 */
export function sparql(text: string | TemplateStringsArray, ...values: unknown[]): SPARQL {
	return isString(text) ? dedent(text) : dedent(text, ...values);
}

/**
 * Creates a SPARQL solution {@link Tuple}.
 *
 * Collects the supplied bindings into a mapping from projected {@link Variable | variables} to the bound RDF
 * {@link Term | terms}. The supplied bindings are cloned, so later changes to them are not reflected in the solution.
 *
 * @param tuple - The variable-to-term bindings making up the solution
 *
 * @returns An immutable {@link Tuple} of the supplied bindings
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#sparqlSolutions SPARQL 1.1 Query Solutions}
 */
export function tuple(tuple: Tuple): Tuple {
	return immutable(tuple);
}

/**
 * Creates a SPARQL triple {@link Pattern}.
 *
 * @param subject - The subject position: a {@link Variable} or a {@link Subject}
 * @param predicate - The predicate position: a {@link Variable} or a {@link Predicate}
 * @param object - The object position: a {@link Variable} or any RDF {@link Term}
 *
 * @returns An immutable {@link Pattern} of the three positions
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#QSynTriples SPARQL 1.1 Triple Patterns}
 */
export function pattern(subject: Variable | Subject, predicate: Variable | Predicate, object: Variable | Term): Pattern {
	return immutable([subject, predicate, object]);
}

/**
 * Creates a SPARQL {@link Variable}.
 *
 * Renders the supplied name into a `?`-prefixed token. A numeric name and its decimal string form canonicalise to the
 * same token (`variable(0)` and `variable("0")` both yield `?0`), so a variable allocated query-side correlates with
 * the same variable decoded from a result row. With no argument, mints a fresh token with a random name for an
 * anonymous variable.
 *
 * @param name - The variable name: a non-negative integer, or a string matching the `VARNAME` production; omitted to
 * 		mint a fresh anonymous variable
 *
 * @returns The variable token
 *
 * @throws RangeError if `name` is a negative or non-integer number, or a malformed string name
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#rVARNAME SPARQL 1.1 §19.8 — VARNAME}
 */
export function variable(name?: number | string): Variable {
	return name === undefined ? `?${crypto.randomUUID().replaceAll("-", "")}`
		: isNumber(name) && Number.isInteger(name) && name >= 0 ? `?${name}`
			: isString(name) && VariablePattern.test(name) ? `?${name}`
				: error(new RangeError(`malformed variable name <${name}>`));
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Wraps a {@link Repository} to coalesce a transaction's updates into as few requests as possible.
 *
 * Returns a repository that delegates every operation to `repository` unchanged outside a transaction. Within
 * {@link Repository.execute | execute}, queries still run directly against the transaction scope, but updates and
 * graph store writes are buffered rather than issued. On successful completion, the buffered writes are flushed in
 * issue order: consecutive updates targeting equal {@link Dataset | datasets} are joined with `;` into a single
 * update, while each {@link RepositoryClient.merge | merge} and {@link RepositoryClient.store | store} is flushed as
 * a separate request, so graph store writes are never folded into a SPARQL update.
 *
 * A task that issues no writes runs none, and a task that throws or rejects discards the buffer, so no partial write
 * reaches the backend. A flush failing part-way leaves the earlier writes applied, unless the wrapped repository rolls
 * back the enclosing transaction, as a repository with native transactions does.
 *
 * @param repository - The repository to wrap
 *
 * @returns An immutable {@link Repository} that buffers a transaction's updates and flushes them coalesced on commit
 */
export function createBufferingRepository(repository: Repository): Repository {

	type Buffered = {

		readonly updates: readonly SPARQL[]
		readonly dataset?: Dataset

	} | {

		readonly write: (client: RepositoryClient) => Promise<void>

	}

	return immutable({

		ask: (query, dataset) => repository.ask(query, dataset),
		select: (query, dataset) => repository.select(query, dataset),
		construct: (query, dataset) => repository.construct(query, dataset),

		update: (update, dataset) => repository.update(update, dataset),

		merge: (triples, graph) => repository.merge(triples, graph),
		store: (triples, graph) => repository.store(triples, graph),

		// within a transaction, accumulate the writes and flush them on commit, one update per run sharing a dataset

		execute: task => repository.execute(async scope => {

			const buffer: Buffered[] = []; // sink for the writes issued by the task through its client

			const value = await task(immutable({

				ask: (query, dataset) => scope.ask(query, dataset),
				select: (query, dataset) => scope.select(query, dataset),
				construct: (query, dataset) => scope.construct(query, dataset),

				update: (update, dataset) => Promise.resolve(void buffer.push({ updates: [update], dataset })),

				merge: (triples, graph) => Promise.resolve(void buffer.push({
					write: client => client.merge(triples, graph)
				})),

				store: (triples, graph) => Promise.resolve(void buffer.push({
					write: client => client.store(triples, graph)
				}))

			}));

			await coalesce(buffer).reduce((flushed, run) => flushed.then(() => "write" in run
				? run.write(scope)
				: scope.update(update(...run.updates), run.dataset)
			), Promise.resolve());

			return value;

		}),

		close: () => repository.close()

	});


	function coalesce(buffer: readonly Buffered[]): readonly Buffered[] {
		return buffer.reduce<readonly Buffered[]>((runs, next) => {

			const last = runs.at(-1);

			return last !== undefined && "updates" in last && "updates" in next && equals(last.dataset, next.dataset)
				? [...runs.slice(0, -1), { ...last, updates: [...last.updates, ...next.updates] }]
				: [...runs, next];

		}, []);
	}

}

/**
 * Wraps a {@link Repository} to log each operation and its elapsed time.
 *
 * Returns a repository that delegates every operation to `repository`, timing each one and reporting it through
 * `logger`: queries and updates log the elapsed milliseconds alongside the request text, and graph store writes
 * alongside the triple count and the target graph, whether issued directly or through the transaction scope handed to
 * an {@link Repository.execute | execute} task, while `execute` also logs the transaction opening, its committed
 * duration, or its abort with the propagated error. The wrapper is otherwise transparent: results, errors, and
 * isolation guarantees are those of the wrapped repository, and so are the requests it sends to the backend.
 *
 * @param repository - The repository to wrap
 * @param logger - The callback invoked with each log message
 *
 * @returns An immutable {@link Repository} that delegates to `repository` while logging operation timings
 */
export function createLoggingRepository(repository: Repository, logger: (message: string) => void): Repository {

	return immutable({

		...logging(repository, logger),

		async execute(task) {

			logger("opening transaction");

			try {

				return await time(() => repository.execute(scope => task(logging(scope, logger))), (_, elapsed) =>
					logger(`committed transaction in <${millis(elapsed)}> ms`)
				);

			} catch ( error ) {

				logger(`aborted transaction / ${error}`);

				throw error;

			}

		},

		close() {

			logger("closing repository");

			return repository.close();

		}

	});


	/**
	 * Wraps a {@link RepositoryClient} to log each query and update with its elapsed time.
	 *
	 * Shared by {@link createLoggingRepository} for both the top-level client surface and the per-transaction scope
	 * handed to an {@link Repository.execute | execute} task, so operations issued within a transaction are logged
	 * just like those issued directly.
	 */
	function logging(client: RepositoryClient, logger: (message: string) => void): RepositoryClient {

		return immutable({

			ask(query, dataset) {

				return time(() => client.ask(query, dataset), (_, elapsed) =>
					logger(`executed query in <${millis(elapsed)}> ms / ${query}`)
				);

			},

			select(query, dataset) {

				return time(() => client.select(query, dataset), (_, elapsed) =>
					logger(`executed query in <${millis(elapsed)}> ms / ${query}`)
				);

			},

			construct(query, dataset) {

				return time(() => client.construct(query, dataset), (_, elapsed) =>
					logger(`executed query in <${millis(elapsed)}> ms / ${query}`)
				);

			},


			update(update, dataset) {

				return time(() => client.update(update, dataset), (_, elapsed) =>
					logger(`executed update in <${millis(elapsed)}> ms / ${update}`)
				);

			},


			merge(triples, graph) {

				return time(() => client.merge(triples, graph), (_, elapsed) =>
					logger(`merged ${target(triples, graph)} in <${millis(elapsed)}> ms`)
				);

			},

			store(triples, graph) {

				return time(() => client.store(triples, graph), (_, elapsed) =>
					logger(`stored ${target(triples, graph)} in <${millis(elapsed)}> ms`)
				);

			}

		});

	}

	/**
	 * Describes the payload of a graph store write for inclusion in a log message.
	 */
	function target(triples: readonly Triple[], graph?: IRI): string {
		return `<${triples.length}> triples into ${graph === undefined ? "default graph" : `<${graph}>`}`;
	}

	/**
	 * Executes an asynchronous task and reports its elapsed time.
	 *
	 * Measures from invocation until the task resolves, handing the value and the elapsed milliseconds to `monitor`. A
	 * rejected task is left unreported, so its caller logs it as an abort rather than as a completed operation.
	 */
	function time<V>(task: () => Promise<V>, monitor: (value: V, elapsed: number) => void): Promise<V> {

		const start = Date.now();

		return task().then(value => {

			monitor(value, Date.now()-start);

			return value;

		});

	}

	/**
	 * Formats an elapsed time in milliseconds for inclusion in a log message.
	 *
	 * Groups thousands with the `en-US` conventions, keeping long durations readable and log messages stable across
	 * host locales.
	 */
	function millis(elapsed: number): string {
		return elapsed.toLocaleString("en-US");
	}

}
