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
 * Provides a single, backend-independent API for working with SPARQL stores. Consumers query and update through
 * the {@link Repository} interface and exchange data as the RDF and SPARQL types defined here, regardless of which
 * connector backs the store.
 *
 * **Media types**
 *
 * - {@link media} — IANA media types for RDF serialisations and SPARQL protocol exchanges
 *
 * **Repository**
 *
 * - {@link Repository} — a {@link RepositoryClient} with transactional `execute` and lifecycle `close`
 * - {@link RepositoryClient} — query and update surface of an RDF store: `ask`/`select`/`construct` and `update`
 *
 * **SPARQL data model**
 *
 * - {@link SPARQL} — query, update, or syntactic fragment as serialised text
 * - {@link Tuple} — `SELECT` query-solution mapping
 * - {@link Pattern} — triple pattern admitting {@link Variable | variables}
 * - {@link Variable} — allocated `?`-prefixed SPARQL variable
 *
 * **RDF data model**
 *
 * - {@link Graph} — flat sequence of {@link Triple | triples}
 * - {@link Triple} — ground subject/predicate/object statement
 * - {@link Subject} — subject position: a {@link Blank | blank node} or an IRI {@link Reference}
 * - {@link Predicate} — predicate position: an IRI {@link Reference} or the `a` shorthand
 * - {@link Object} — object position: any {@link Term}
 * - {@link Term} — RDF term: a blank node, an IRI, or a literal
 * - {@link Blank} — `_:`-prefixed blank-node label
 * - {@link Reference} — absolute IRI
 * - {@link Tagged} — language-tagged literal
 * - {@link Typed} — datatype-typed literal
 *
 * **SPARQL type guards**
 *
 * - {@link isTuple} — {@link Tuple} guard
 * - {@link isPattern} — {@link Pattern} guard
 * - {@link isVariable} — {@link Variable} guard
 *
 * **RDF type guards**
 *
 * - {@link isGraph} — {@link Graph} guard
 * - {@link isTriple} — {@link Triple} guard
 * - {@link isSubject} — {@link Subject} guard
 * - {@link isPredicate} — {@link Predicate} guard
 * - {@link isObject} — {@link Object} guard
 * - {@link isTerm} — {@link Term} guard
 * - {@link isBlank} — {@link Blank} guard
 * - {@link isReference} — {@link Reference} guard
 * - {@link isTagged} — {@link Tagged} guard
 * - {@link isTyped} — {@link Typed} guard
 *
 * **SPARQL factories**
 *
 * - {@link tuple} — construct a {@link Tuple}
 * - {@link pattern} — construct a {@link Pattern}
 * - {@link variable} — construct a {@link Variable}
 *
 * **RDF factories**
 *
 * - {@link graph} — construct a {@link Graph}
 * - {@link triple} — construct a {@link Triple}
 * - {@link blank} — construct a {@link Blank | blank node}
 * - {@link reference} — construct an IRI {@link Reference}
 * - {@link tagged} — construct a {@link Tagged} literal
 * - {@link typed} — construct a {@link Typed} literal
 *
 * **Utilities**
 *
 * - {@link skolemize} — replace a sequence's blank nodes with minted IRI references
 *
 * **Wrappers**
 *
 * - {@link createBufferingRepository} — wrap a {@link Repository} to coalesce a transaction's updates into one request
 * - {@link createLoggingRepository} — wrap a {@link Repository} to log each operation and its elapsed time
 *
 * @module index
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/ SPARQL 1.1 Query Language}
 * @see {@link https://www.w3.org/TR/sparql11-update/ SPARQL 1.1 Update}
 * @see {@link https://www.w3.org/TR/rdf11-concepts/ RDF 1.1 Concepts and Abstract Syntax}
 */

import { isArray, isNumber, isObject as isRecord, isString, type Scalar } from "@metreeca/core";
import { immutable } from "@metreeca/core/deep";
import { isTag, type Tag } from "@metreeca/core/language";
import { error, message, time } from "@metreeca/core/report";
import { type IRI, isIRI } from "@metreeca/core/resource";
import { createScope } from "@metreeca/core/scope";
import { update } from "./dsl.js";


/**
 * Matches a well-formed string {@link Variable} name.
 *
 * An ASCII subset of the SPARQL `VARNAME` production (`PN_CHARS_U | [0-9]`, repeated): admits the numeric names the
 * wire uses (`0`, `1`, …) alongside identifier-like names, and excludes `-`/`.` and any delimiter.
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#rVARNAME SPARQL 1.1 — VARNAME}
 */
const VariablePattern = /^[A-Za-z0-9_]+$/;

/**
 * Matches a well-formed string {@link Blank} label.
 *
 * An ASCII subset of the N-Triples `BLANK_NODE_LABEL` body: a leading `PN_CHARS_U` or digit, an optional interior run
 * that may carry `.` and `-`, and a non-`.` trailing character.
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-BLANK_NODE_LABEL N-Triples §3 — BLANK_NODE_LABEL}
 */
const BlankPattern = /^[A-Za-z0-9_](?:[A-Za-z0-9_.-]*[A-Za-z0-9_-])?$/;


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * IANA media types for RDF serialisations and SPARQL protocol exchanges.
 *
 * @see {@link https://www.w3.org/TR/n-triples/ N-Triples}
 * @see {@link https://www.w3.org/TR/sparql11-protocol/#query-bindings-http SPARQL 1.1 Protocol — Query Operation}
 * @see {@link https://www.w3.org/TR/sparql11-protocol/#update-bindings-http SPARQL 1.1 Protocol — Update Operation}
 * @see {@link https://www.w3.org/TR/sparql11-results-json/ SPARQL 1.1 Query Results JSON Format}
 */
export const media = immutable({

	ntriples: "application/n-triples",

	query: "application/sparql-query",
	update: "application/sparql-update",
	results: "application/sparql-results+json"

});


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
	 * The task receives a per-call {@link RepositoryClient} bound to a transaction; updates issued through it are
	 * applied within the transaction in order. If the task completes successfully, the transaction commits. If the task
	 * throws or rejects, the transaction rolls back and the error is propagated to the caller as a promise
	 * rejection. Concurrent top-level `execute` calls run in independent transactions and never share state.
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
	 * > Callers MUST NOT use the repository after `close` settles: `ask`, `select`, `construct`, `update`, and
	 * > `execute` all have undefined behaviour once the underlying resources are released.
	 *
	 * @returns A promise resolving when all resources have been released; rejects with a
	 * {@link @metreeca/core!Problem | Problem} if a clean-up error occurs
	 */
	close(): Promise<void>;

}

/**
 * SPARQL repository query and update operations.
 *
 * Groups the four core operations: `ask`, `select`, and `construct` read from the backing RDF store, and `update`
 * writes to it. {@link Repository} extends this surface for standalone use; the same operations are also handed to a
 * task as the per-call client inside {@link Repository.execute | execute}, where they run within the enclosing
 * transaction.
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/ SPARQL 1.1 Query Language}
 * @see {@link https://www.w3.org/TR/sparql11-update/ SPARQL 1.1 Update}
 */
export interface RepositoryClient {

	/**
	 * Execute an ASK query.
	 *
	 * @param query - The SPARQL ASK query
	 *
	 * @returns A promise resolving to true if the query pattern matches; false otherwise
	 */
	ask(query: SPARQL): Promise<boolean>;

	/**
	 * Execute a SELECT query.
	 *
	 * @param query - The SPARQL SELECT query
	 *
	 * @returns A promise resolving to the result tuples
	 */
	select(query: SPARQL): Promise<readonly Tuple[]>;

	/**
	 * Execute a CONSTRUCT query.
	 *
	 * @param query - The SPARQL CONSTRUCT query
	 *
	 * @returns A promise resolving to the constructed triples
	 */
	construct(query: SPARQL): Promise<readonly Triple[]>;

	/**
	 * Execute a SPARQL UPDATE operation.
	 *
	 * @param update - The SPARQL UPDATE request
	 */
	update(update: SPARQL): Promise<void>;

}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * A SPARQL query, update, or syntactic fragment as serialised text.
 *
 * The wire format for {@link Repository} I/O: complete queries and updates exchanged with the backend, and
 * partial fragments (triple patterns, graph patterns, projections, filters, …) composed into them.
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/ SPARQL 1.1 Query Language}
 * @see {@link https://www.w3.org/TR/sparql11-update/ SPARQL 1.1 Update}
 */
export type SPARQL = string

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
 * A SPARQL triple pattern, as a subject/predicate/object statement with optional {@link Variable | variables}.
 *
 * Each position generalises the corresponding {@link Triple} position by also admitting a {@link Variable}: the subject
 * is a variable, an IRI {@link Reference}, or a {@link Blank | blank node}; the predicate is a variable, an IRI, or the
 * `"a"` ({@link https://www.w3.org/TR/sparql11-query/#abbrevRdfType `rdf:type` shorthand}); the object is a variable or
 * any {@link Term}. Unlike a ground {@link Triple}, a pattern may leave positions unbound for matching. Construct one
 * with {@link pattern}.
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#QSynTriples SPARQL 1.1 Triple Patterns}
 */
export type Pattern = readonly [
		Variable | Subject,
		Variable | Predicate,
		Variable | Object
];

/**
 * An allocated SPARQL variable.
 *
 * A `?`-prefixed token, for example `?0` or `?name`, whose body names the variable. The value is its own SPARQL
 * rendering, so it doubles as a {@link Tuple} key and as the query-text token emitted by the `dsl` module. Mint
 * one with {@link variable}.
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#QSynVariables SPARQL 1.1 Variables}
 */
export type Variable =
	| `?${string}`


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * An RDF graph, as a flat sequence of {@link Triple | triples}.
 *
 * Carried as a plain array of statements; read as an RDF graph, neither their order nor any repetition is significant.
 * Construct one with {@link graph}.
 *
 * @see {@link https://www.w3.org/TR/rdf11-concepts/#dfn-rdf-graph RDF 1.1 Graphs}
 * @see The `rdf` module's graph DSL, which assembles values of this type
 */
export type Graph =
	| readonly Triple[];

/**
 * An RDF triple, as a subject/predicate/object statement.
 *
 * The subject is an IRI {@link Reference} or a {@link Blank | blank node}; the predicate is always an IRI; the object
 * admits any {@link Term}: an IRI, a blank node, or a language-{@link Tagged | tagged} or datatype-{@link Typed |
 * typed} literal. Returned by {@link RepositoryClient.construct | `RepositoryClient.construct`}, one entry per produced
 * statement.
 * Construct one with {@link triple}.
 *
 * > [!NOTE]
 * > A {@link Blank | blank node} carries no stable identity across queries or stores: its label is meaningful only
 * > within the document that introduced it. Durable anchors that must survive a round-trip (embedded resources,
 * > intermediate structural anchors, and so on) are minted as opaque IRIs in the `urn:uuid:` scheme rather than left
 * > blank.
 *
 * @see {@link https://www.w3.org/TR/rdf11-concepts/#dfn-rdf-triple RDF 1.1 Triples}
 */
export type Triple = readonly [
	Subject,
	Predicate,
	Object
];


/**
 * The subject position of an RDF {@link Triple}.
 *
 * Per RDF 1.1, the subject is either an IRI {@link Reference} or a {@link Blank | blank node}.
 *
 * @see {@link https://www.w3.org/TR/rdf11-concepts/#dfn-subject RDF 1.1 Subject}
 */
export type Subject =
	| Blank
	| Reference;

/**
 * The predicate position of an RDF {@link Triple}.
 *
 * Per RDF 1.1, the predicate is always an IRI {@link Reference}. The `"a"` literal is the SPARQL shorthand
 * for the `rdf:type` predicate.
 *
 * @see {@link https://www.w3.org/TR/rdf11-concepts/#dfn-predicate RDF 1.1 Predicate}
 */
export type Predicate =
	| "a"
	| Reference;

/**
 * The object position of an RDF {@link Triple}.
 *
 * Per RDF 1.1, the object admits any {@link Term} — an IRI {@link Reference}, a {@link Blank | blank node},
 * or a language-{@link Tagged | tagged} or datatype-{@link Typed | typed} literal.
 *
 * @see {@link https://www.w3.org/TR/rdf11-concepts/#dfn-object RDF 1.1 Object}
 */
export type Object =
	| Term;


/**
 * An RDF term.
 *
 * The union of a {@link Blank | blank node}, an IRI {@link Reference}, a language-{@link Tagged | tagged} literal, and
 * a datatype-{@link Typed | typed} literal: the values admitted in the object position of a {@link Triple}. The
 * subject position narrows to {@link Subject} (a blank node or an IRI) and the predicate to {@link Predicate} (an IRI
 * or the `"a"` shorthand).
 *
 * @see {@link https://www.w3.org/TR/rdf11-concepts/#dfn-rdf-term RDF 1.1 Terms}
 */
export type Term =
	| Blank
	| Reference
	| Tagged
	| Typed;

/**
 * An RDF blank node.
 *
 * A `_:`-prefixed label, for example `_:0`, identifying a blank node within a single document. The value is its own
 * N-Triples/SPARQL rendering. Blank-node identity is document-scoped: a label carries no meaning across queries or
 * stores. Mint one with {@link blank}.
 *
 * @see {@link https://www.w3.org/TR/rdf11-concepts/#dfn-blank-node RDF 1.1 Blank Nodes}
 */
export type Blank =
	| `_:${string}`

/**
 * An IRI reference.
 *
 * An absolute {@link IRI} denoting an RDF resource: the {@link Predicate} of every {@link Triple}, and the IRI form a
 * {@link Subject} or object {@link Term} may take. Construct one with {@link reference}.
 *
 * > [!WARNING]
 * > This is a type alias for documentation purposes only. Branding was considered but not adopted due to
 * > interoperability issues with tools relying on static code analysis.
 *
 * @see {@link https://www.w3.org/TR/rdf11-concepts/#section-IRIs RDF 1.1 IRIs}
 */
export type Reference =
	| IRI

/**
 * An RDF language-tagged string, as a lexical-form/language-tag pair.
 *
 * Pairs the lexical form with the BCP 47 tag identifying its natural language. Distinct from a
 * {@link Typed} literal because the language tag participates in term identity and equality. One of the
 * literal forms making up {@link Term}. Construct one with {@link tagged}.
 *
 * @see {@link https://www.w3.org/TR/rdf11-concepts/#dfn-language-tagged-string RDF 1.1 Language-tagged strings}
 */
export type Tagged = {

	readonly text: string;
	readonly language: Tag

};

/**
 * An RDF datatype-typed literal, as a lexical-form/datatype-IRI pair.
 *
 * Pairs the lexical form with the IRI of its XSD (or user-defined) datatype. Per RDF 1.1, a literal with
 * no datatype IRI is interpreted as `xsd:string`; `datatype` is therefore optional and absent for plain
 * literals. One of the literal forms making up {@link Term}. Construct one with {@link typed}.
 *
 * @see {@link https://www.w3.org/TR/rdf11-concepts/#dfn-literal RDF 1.1 Literals}
 */
export type Typed = {

	readonly text: string;
	readonly datatype?: Reference

};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Checks whether a value is a SPARQL solution {@link Tuple}.
 *
 * @param value The value to check
 *
 * @returns true if `value` is an object mapping {@link Variable} tokens to RDF {@link Term | terms};
 * false otherwise
 */
export function isTuple(value: unknown): value is Tuple {
	return isRecord(value, (v, k) =>
		isVariable(k) && isTerm(v)
	);
}

/**
 * Checks whether a value is a SPARQL triple {@link Pattern}.
 *
 * @param value The value to check
 *
 * @returns true if `value` is a three-element `[subject, predicate, object]` tuple whose positions are, respectively, a
 *          valid {@link Subject}, {@link Predicate}, or {@link Object}, or a {@link Variable} in any position; false
 *          otherwise
 */
export function isPattern(value: unknown): value is Pattern {
	return isArray(value, [
		v => isSubject(v) || isVariable(v),
		v => isPredicate(v) || isVariable(v),
		v => isObject(v) || isVariable(v)
	]);
}

/**
 * Checks whether a value is a SPARQL {@link Variable}.
 *
 * @param value The value to check
 *
 * @returns true if `value` is a `?`-prefixed token whose name is well-formed (matching `VariablePattern`, as enforced
 * by {@link variable}); false otherwise
 */
export function isVariable(value: unknown): value is Variable {
	return isString(value) && value.startsWith("?") && VariablePattern.test(value.slice(1));
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Checks whether a value is an RDF {@link Graph}.
 *
 * @param value The value to check
 *
 * @returns true if `value` is an array of RDF {@link Triple | triples}; false otherwise
 */
export function isGraph(value: unknown): value is Graph {
	return isArray(value, isTriple);
}

/**
 * Checks whether a value is an RDF {@link Triple}.
 *
 * @param value The value to check
 *
 * @returns true if `value` is a three-element `[subject, predicate, object]` tuple; false otherwise
 */
export function isTriple(value: unknown): value is Triple {
	return isArray(value, [
		isSubject,
		isPredicate,
		isObject
	]);
}


/**
 * Checks whether a value is the {@link Subject} position of a {@link Triple}.
 *
 * @param value The value to check
 *
 * @returns true if `value` is a {@link Blank | blank node} or an IRI {@link Reference}; false otherwise
 */
export function isSubject(value: unknown): value is Subject {
	return isBlank(value) || isReference(value);
}

/**
 * Checks whether a value is the {@link Predicate} position of a {@link Triple}.
 *
 * @param value The value to check
 *
 * @returns true if `value` is the `"a"` shorthand or an IRI {@link Reference}; false otherwise
 */
export function isPredicate(value: unknown): value is Predicate {
	return value === "a" || isReference(value);
}

/**
 * Checks whether a value is the {@link Object} position of a {@link Triple}.
 *
 * @param value The value to check
 *
 * @returns true if `value` is an RDF {@link Term}; false otherwise
 */
export function isObject(value: unknown): value is Object {
	return isTerm(value);
}


/**
 * Checks whether a value is an RDF {@link Term}.
 *
 * @param value The value to check
 *
 * @returns true if `value` is a {@link Blank | blank node}, an IRI {@link Reference}, a
 * language-{@link Tagged} string, or a datatype-{@link Typed} literal; false otherwise
 */
export function isTerm(value: unknown): value is Term {
	return isBlank(value) || isReference(value) || isTagged(value) || isTyped(value);
}

/**
 * Checks whether a value is an RDF {@link Blank | blank node}.
 *
 * @param value The value to check
 *
 * @returns true if `value` is a `_:`-prefixed token whose label is well-formed (matching `BlankPattern`, as enforced
 * by {@link blank}); false otherwise
 */
export function isBlank(value: unknown): value is Blank {
	return isString(value) && value.startsWith("_:") && BlankPattern.test(value.slice(2));
}

/**
 * Checks whether a value is a {@link Reference}.
 *
 * @param value The value to check
 *
 * @returns true if `value` is an absolute IRI; false otherwise
 */
export function isReference(value: unknown): value is Reference {
	return isIRI(value, "absolute");
}

/**
 * Checks whether a value is an RDF language-{@link Tagged} string.
 *
 * @param value The value to check
 *
 * @returns true if `value` is a `{ text, language }` pair where `language` is a BCP 47 tag; false otherwise
 */
export function isTagged(value: unknown): value is Tagged {
	return isRecord(value, { text: isString, language: isTag });
}

/**
 * Checks whether a value is an RDF datatype-{@link Typed} literal.
 *
 * @param value The value to check
 *
 * @returns true if `value` is a `{ text, datatype? }` pair whose `datatype`, when present, is an absolute IRI
 * {@link Reference}; false otherwise
 */
export function isTyped(value: unknown): value is Typed {
	return isRecord(value, { text: isString, datatype: v => v === undefined || isReference(v) });
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Constructs a SPARQL triple {@link Pattern}.
 *
 * Assembles a subject/predicate/object pattern from ready positions, each admitting a {@link Variable} in addition to
 * the corresponding {@link Triple} position. The returned tuple is frozen.
 *
 * @param subject - The subject position: a {@link Variable}, a {@link Blank | blank node}, or an IRI {@link Reference}
 * @param predicate - The predicate position: a {@link Variable}, an IRI {@link Reference}, or the `"a"` shorthand
 * @param object - The object position: a {@link Variable} or any RDF {@link Term}
 *
 * @returns A frozen {@link Pattern} of the three positions
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#QSynTriples SPARQL 1.1 Triple Patterns}
 */
export function pattern(subject: Variable | Subject,
	predicate: Variable | Predicate,
	object: Variable | Object
): Pattern {
	return Object.freeze([subject, predicate, object]);
}

/**
 * Constructs a SPARQL solution {@link Tuple}.
 *
 * Assembles a mapping from projected {@link Variable | variables} to the bound RDF {@link Term | terms}. The returned
 * record is frozen.
 *
 * @param bindings - The variable-to-term bindings
 *
 * @returns A frozen {@link Tuple} of the supplied bindings
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#sparqlSolutions SPARQL 1.1 Query Solutions}
 */
export function tuple(bindings: Tuple): Tuple {
	return Object.freeze({ ...bindings });
}

/**
 * Constructs a SPARQL {@link Variable}.
 *
 * Renders the supplied name into a `?`-prefixed token. A numeric name and its decimal string form canonicalise to the
 * same token (`variable(0)` and `variable("0")` both yield `?0`), so a variable allocated query-side correlates with
 * the same variable decoded from a result row. With no argument, mints a fresh token with a random name for an
 * anonymous variable.
 *
 * @param name - The variable name: a non-negative integer, or a string matching `VariablePattern`; omitted to
 * 		mint a fresh anonymous variable
 *
 * @returns The variable token
 *
 * @throws RangeError if `name` is a negative or non-integer number, or a malformed string name
 */
export function variable(name?: number | string): Variable {
	return name === undefined ? `?${crypto.randomUUID().replaceAll("-", "")}`
		: (isNumber(name) ? Number.isInteger(name) && name >= 0 : VariablePattern.test(name)) ? `?${name}`
			: error(new RangeError(`malformed variable name <${name}>`));
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Constructs an RDF {@link Graph}.
 *
 * Collects the supplied {@link Triple | triples} into a flat sequence. The returned array is frozen.
 *
 * @param triples - The triples making up the graph
 *
 * @returns A frozen {@link Graph} of the supplied triples
 *
 * @see {@link https://www.w3.org/TR/rdf11-concepts/#dfn-rdf-graph RDF 1.1 Graphs}
 */
export function graph(...triples: readonly Triple[]): Graph {
	return Object.freeze(triples);
}

/**
 * Constructs an RDF {@link Triple}.
 *
 * Assembles a subject/predicate/object statement from ready positions. The returned tuple is frozen.
 *
 * @param subject - The subject: a {@link Blank | blank node} or an IRI {@link Reference}
 * @param predicate - The predicate: an IRI {@link Reference} or the `"a"` shorthand
 * @param object - The object: any RDF {@link Term}
 *
 * @returns A frozen {@link Triple} of the three positions
 *
 * @see {@link https://www.w3.org/TR/rdf11-concepts/#dfn-rdf-triple RDF 1.1 Triples}
 */
export function triple(subject: Subject, predicate: Predicate, object: Object): Triple {
	return Object.freeze([subject, predicate, object]);
}

/**
 * Constructs an RDF {@link Blank | blank node}.
 *
 * Renders the supplied label into a `_:`-prefixed token. With no argument, mints a fresh token with a random label for
 * an anonymous node; supply a label only where blank-node identity must be correlated within a single document.
 *
 * @param label - The blank-node label: a non-negative integer, or a string matching `BlankPattern`; omitted to
 * 		mint a fresh anonymous node
 *
 * @returns The blank-node label
 *
 * @throws RangeError if `label` is a negative or non-integer number, or a malformed string label
 */
export function blank(label?: number | string): Blank {
	return label === undefined ? `_:${crypto.randomUUID().replaceAll("-", "")}`
		: (isNumber(label) ? Number.isInteger(label) && label >= 0 : BlankPattern.test(label)) ? `_:${label}`
			: error(new RangeError(`malformed blank-node label <${label}>`));
}

/**
 * Constructs an IRI {@link Reference}.
 *
 * Returns a well-formed absolute IRI unchanged. With no argument, mints a fresh opaque `urn:uuid:` IRI for an
 * anonymous resource anchor. A blank-node label is not an absolute IRI and is rejected like any other malformed value.
 *
 * @param value - The IRI to validate; omitted to mint a fresh `urn:uuid:` IRI
 *
 * @returns The validated or minted reference
 *
 * @throws RangeError if `value` is a relative or otherwise malformed IRI
 */
export function reference(value?: string): Reference {
	return value === undefined ? `urn:uuid:${crypto.randomUUID()}`
		: isReference(value) ? value
			: error(new RangeError(`unsupported relative or malformed IRI reference <${value}>`));
}

/**
 * Constructs a language-{@link Tagged} {@link Term}.
 *
 * Pairs a lexical form with the BCP 47 tag identifying its natural language. The returned record is frozen.
 *
 * @param text - The lexical form of the literal
 * @param language - The BCP 47 language tag
 *
 * @returns A frozen {@link Tagged} record carrying the lexical text and the language tag
 *
 * @see {@link https://www.w3.org/TR/rdf11-concepts/#dfn-language-tagged-string RDF 1.1 Language-tagged strings}
 */
export function tagged(text: string, language: Tag): Tagged {
	return Object.freeze({ text, language });
}

/**
 * Constructs a datatype-{@link Typed} {@link Term}.
 *
 * Pairs a lexical form with the IRI of its XSD (or user-defined) datatype. Per RDF 1.1, a literal with no
 * datatype IRI is interpreted as `xsd:string`; `datatype` is therefore optional and may be omitted for plain
 * strings. A non-string scalar is coerced to its lexical form via `String()`. The returned record is frozen.
 *
 * @param text - The lexical form of the literal, as a {@link Scalar} coerced to a string via `String()`
 * @param datatype - The IRI of the literal datatype, or omitted for an `xsd:string` literal
 *
 * @returns A frozen {@link Typed} record carrying the lexical text and (optionally) the datatype IRI
 *
 * @see {@link https://www.w3.org/TR/rdf11-concepts/#dfn-literal RDF 1.1 Literals}
 */
export function typed(text: Scalar, datatype?: Reference): Typed {
	return Object.freeze({ text: String(text), datatype });
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Replaces blank nodes in a {@link Triple} sequence with minted IRI references.
 *
 * Skolemises each {@link Blank | blank node} to a fresh `urn:uuid:` {@link Reference}, correlating repeated labels to
 * the same reference within the sequence so blank-node identity is preserved; ground terms pass through unchanged. The
 * correlation scope is per call, so the same label skolemised in a later call yields a different reference.
 *
 * @param triples The triple sequence to skolemise
 *
 * @returns A new sequence with every {@link Blank | blank node} replaced by a minted IRI {@link Reference}
 *
 * @see {@link https://www.w3.org/TR/rdf11-concepts/#section-skolemization RDF 1.1 — Skolemization}
 */
export function skolemize(triples: readonly Triple[]): readonly Triple[] {

	const references = createScope(() => reference());

	return triples.map(([subject, predicate, object]) =>
		[resolve(subject), resolve(predicate), resolve(object)]
	);

	function resolve<T extends Term>(term: T) {
		return isBlank(term) ? references.resolve(term) : term;
	}

}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Wraps a {@link Repository} to coalesce a transaction's updates into a single request.
 *
 * Returns a repository that delegates every operation to `repository` unchanged outside a transaction. Within
 * {@link Repository.execute | execute}, queries still run directly against the transaction scope, but updates are
 * buffered rather than issued: on successful completion the buffered updates are flushed as one `;`-joined update, and
 * if the task issues none, no update runs at all. A task that throws or rejects discards the buffer, so no partial
 * update reaches the backend.
 *
 * @param repository - The repository to wrap
 *
 * @returns An immutable {@link Repository} that buffers a transaction's updates and flushes them as a single update on
 * commit
 */
export function createBufferingRepository(repository: Repository): Repository {
	return immutable({

		ask: query => repository.ask(query),
		select: query => repository.select(query),
		construct: query => repository.construct(query),
		update: update => repository.update(update),

		// within a transaction, accumulate the updates and flush them as a single update on commit

		execute: task => repository.execute(async scope => {

			const updates: SPARQL[] = [];

			const value = await task(immutable({

				ask: query => scope.ask(query),
				select: query => scope.select(query),
				construct: query => scope.construct(query),
				update: update => Promise.resolve(void updates.push(update))

			}));

			if ( updates.length > 0 ) {
				await scope.update(update(...updates));
			}

			return value;

		}),

		close: () => repository.close()

	});
}

/**
 * Wraps a {@link Repository} to log each operation and its elapsed time.
 *
 * Returns a repository that delegates every operation to `repository`, timing each one and reporting it through
 * `logger`: queries and updates log the elapsed milliseconds alongside the request text, whether issued directly or
 * through the transaction scope handed to an {@link Repository.execute | execute} task, while `execute` additionally
 * logs the transaction opening, its committed duration, or its abort with the propagated error. The wrapper is
 * otherwise transparent: results, errors, and isolation guarantees are those of the wrapped repository.
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
					logger(`committed transaction in <${message(elapsed)}> ms`)
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

			ask(query) {

				return time(() => client.ask(query), (_, elapsed) =>
					logger(`executed query in <${message(elapsed)}> ms / ${query}`)
				);

			},

			select(query) {

				return time(() => client.select(query), (_, elapsed) =>
					logger(`executed query in <${message(elapsed)}> ms / ${query}`)
				);

			},

			construct(query) {

				return time(() => client.construct(query), (_, elapsed) =>
					logger(`executed query in <${message(elapsed)}> ms / ${query}`)
				);

			},

			update(update) {

				return time(() => client.update(update), (_, elapsed) =>
					logger(`executed update in <${message(elapsed)}> ms / ${update}`)
				);

			}

		});

	}

}
