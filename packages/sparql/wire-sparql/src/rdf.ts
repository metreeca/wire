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
 * DSL for assembling RDF graphs.
 *
 * Provides declarative combinators that map domain resources to the RDF {@link Graph | graphs} representing them.
 *
 * **Types**
 *
 * - {@link Some} — the zero/one/many input shape accepted across the DSL
 * - {@link Mapper} — maps a domain value to its RDF rendering, a single {@link Term} or a whole {@link Graph}
 *
 * **Combinators**
 *
 * - {@link describe} — anchors a resource graph at a chosen subject, threading that subject into a builder callback so
 *   its properties hang off it
 * - {@link resource} — concatenates per-property graphs into one resource graph
 * - {@link property} — links subjects to objects under a predicate, taking objects either as ready
 *   {@link Term | terms} or as values run through a {@link Mapper} and embedded at their own root
 *
 * **Term encoders**
 *
 * - {@link link} — encodes references as IRI terms
 * - {@link data} — encodes scalars as datatype-typed literals
 * - {@link text} — encodes a language map as language-tagged or plain literals
 * - {@link term} — applies a per-value encoder across a {@link Some} input, one term per value
 *
 * **Usage**
 *
 * Every combinator returns a {@link Graph}, so a resource and its embedded sub-resources assemble as one nested
 * expression:
 *
 * ```ts
 * const ex = "https://example.org/";
 *
 * function encodeVendor(vendor: Vendor): Graph {
 *     return describe(reference(vendor.id), id => resource(              // anchored at the vendor's own IRI
 *         property(id, "a", link(vendor.types)),                         // rdf:type via the "a" shorthand
 *         property(id, `${ex}name`, text(vendor.name)),                  // language map to tagged/plain literals
 *         property(id, `${ex}founded`, data(vendor.founded, xsd.gYear)), // scalar to a datatype-typed literal
 *         property(id, `${ex}address`, vendor.address, encodeAddress),   // embed a sub-resource at its own root
 *         property(link(vendor.products), `${ex}vendor`, id)             // inverse: each product links back to it
 *     ));
 * }
 *
 * function encodeAddress(address: Address): Graph {
 *     return describe(blank(), anchor => resource(                       // self-anchored at a fresh blank node
 *         property(anchor, `${ex}street`, data(address.street)),
 *         property(anchor, `${ex}city`, data(address.city))
 *     ));
 * }
 * ```
 *
 * @module
 *
 * @see {@link https://www.w3.org/TR/rdf11-concepts/ RDF 1.1 Concepts}
 */

import { type Scalar } from "@metreeca/core";
import { Tag } from "@metreeca/core/language";
import {
	type Graph,
	type Object,
	type Predicate,
	reference,
	type Reference,
	type Subject,
	type Tagged,
	tagged,
	type Term,
	type Typed,
	typed
} from "@metreeca/wire-sparql";


/**
 * Zero, one, or many values of type `T`.
 *
 * The uniform input shape accepted across the DSL, letting encoders forward optional, scalar, or array-valued
 * properties without branching: the `values` helper normalises every case to an array.
 *
 * @typeParam T - The element type carried in the single-value and array cases
 */
export type Some<T> = undefined | T | readonly T[];

/**
 * Maps a domain value to its RDF rendering: either a single {@link Term} or a whole {@link Graph}.
 *
 * How each rendering is consumed is the caller's concern: {@link property} takes a {@link Term} as a direct triple
 * object and a {@link Graph} as a sub-resource linked at its own root. A mapper is otherwise a plain value-to-graph
 * function, free to mint its own blank-node anchors and never handed one by the caller.
 *
 * @typeParam T - The domain value being mapped
 */
export type Mapper<T> = (value: T) => Term | Graph;


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Anchors a resource graph at a chosen subject, threaded into a builder.
 *
 * Passes `subject` to `builder` and returns the {@link Graph} it produces, so a resource and the subject its
 * {@link property} statements hang off are written as one expression rather than a local binding followed by a
 * {@link resource} call. The subject is the caller's to choose: an IRI {@link Reference} for an identified resource, or
 * a blank node for an anonymous embedded one.
 *
 * @param subject - The subject the built properties hang off
 * @param builder - Builds the resource graph anchored at `subject`
 *
 * @returns The assembled resource graph
 */
export function describe(subject: Subject, builder: (subject: Subject) => Graph): Graph {
	return builder(subject);
}

/**
 * Concatenates property {@link Graph | graphs} into a single graph.
 *
 * The container combinator: flattens the per-property statements of one resource, along with any embedded
 * sub-resources, into one flat triple sequence.
 *
 * @param properties - The property graphs to merge
 *
 * @returns The concatenated graph
 */
export function resource(...properties: readonly Graph[]): Graph {
	return properties.flat();
}

/**
 * Builds direct triples linking each subject to each object term.
 *
 * Every subject/object pair yields one direct triple, the object taken as a ready RDF {@link Term}.
 *
 * @param subject - The subject(s) the statements hang off
 * @param predicate - The predicate IRI shared by every emitted statement
 * @param objects - The RDF {@link Term | term} object(s)
 *
 * @returns The graph of direct statements
 */
export function property(subject: Some<Subject>, predicate: Predicate, objects: Some<Object>): Graph;

/**
 * Builds triples by {@link Mapper | mapping} each object, embedding sub-graphs at their root.
 *
 * Each object is run through `mapper`: a {@link Term} result becomes a direct triple object, while a {@link Graph}
 * result is embedded as a sub-resource and linked at its own root. That root is derived structurally rather than
 * supplied: the single subject of the encoded graph that never appears in object position, letting encoders self-root
 * their output at a fresh blank node and freeing callers from threading anchors. An empty encoded graph contributes no
 * triples.
 *
 * > [!IMPORTANT]
 * > A {@link Graph} returned by `mapper` must be a single-rooted tree: exactly one subject is source-only (never
 * > appearing in object position), and that subject serves as the link target. The two degenerate shapes throw rather
 * > than being silently mislinked:
 * >
 * > - a **cyclic** graph uses every subject in object position, leaving no source-only subject (zero roots);
 * > - a **disconnected** graph holds independent subtrees, each with its own source-only subject (multiple roots).
 *
 * @typeParam V - The domain value type accepted by `mapper`
 *
 * @param subject - The subject(s) the statements hang off
 * @param predicate - The predicate IRI shared by every emitted statement
 * @param objects - The object value(s) passed to `mapper`
 * @param mapper - Maps each object to a term or an embedded graph
 *
 * @returns The graph of emitted statements, including any embedded sub-resources
 *
 * @throws RangeError On an encoded graph without a unique root subject: zero roots when cyclic, multiple when
 *     disconnected
 */
export function property<V>(subject: Some<Subject>, predicate: Predicate, objects: Some<V>, mapper: Mapper<V>): Graph;

export function property<V>(subject: Some<Subject>, predicate: Predicate, objects: Some<V>, mapper?: Mapper<V>): Graph {

	if ( mapper ) {

		return values(objects).flatMap(object => {

			const rdf = mapper(object);

			return isTerm(rdf) ? property(subject, predicate, rdf)
				: rdf.length > 0 ? resource(property(subject, predicate, anchor(rdf)), rdf)
					: [];

		});

	} else { // ;(cast) the non-embedded overload accepts only Some<Object>, so each object is a Term

		return values(subject).flatMap(subject =>
			values(objects).map(object => [subject, predicate, object as Object])
		);

	}


	/**
	 * Tests whether a {@link Mapper} result is a single {@link Term} rather than a {@link Graph}.
	 *
	 * Discriminates on array-ness, the sole structural difference: a graph is an array of triples, every term form is
	 * not.
	 */
	function isTerm(value: Term|Graph): value is Term {
		return !Array.isArray(value);
	}

	/**
	 * Finds the root subject an embedded graph hangs off: the single subject that never appears in object position.
	 *
	 * Collects every subject that is not also used as an object; a well-formed single-rooted tree leaves exactly one.
	 * The {@link property} encoded overload documents the single-rooted-tree constraint and its cyclic and disconnected
	 * failure modes.
	 *
	 * @param graph - The non-empty embedded graph to root
	 *
	 * @returns The graph's unique root subject
	 *
	 * @throws RangeError On a graph without a unique root subject, whether cyclic (zero roots) or disconnected
	 *     (multiple roots)
	 */
	function anchor(graph: Graph): Subject {

		const objects = new Set<Object>(graph.map(([, , o]) => o));
		const sources = [...new Set(graph.map(([s]) => s))].filter(subject => !objects.has(subject));

		const [source, ...rest] = sources;

		if ( source === undefined ) {
			throw new RangeError(`missing root subject in cyclic embedded graph`);
		}

		if ( rest.length > 0 ) {
			throw new RangeError(`disjoint embedded graph with multiple root subjects [${sources.join(", ")}]`);
		}

		return source;
	}

}


/**
 * Encodes references as IRI {@link Reference | terms}.
 *
 * @param link - The reference value(s) to encode
 *
 * @returns The encoded IRI terms
 */
export function link(link: Some<Reference>): readonly Reference[] {
	return term(link, reference);
}

/**
 * Encodes scalars as datatype-{@link Typed | typed} literals.
 *
 * @param data - The scalar value(s) to encode, stringified to their lexical form
 * @param datatype - The literal datatype IRI; omitted for plain `xsd:string` literals
 *
 * @returns The encoded typed literals
 */
export function data(data: Some<Scalar>, datatype?: Reference): readonly Typed[] {
	return term(data, data => typed(String(data), datatype));
}

/**
 * Encodes a language map as language-tagged or plain literals.
 *
 * > [!IMPORTANT]
 * > By convention the `und` (undetermined) tag yields a plain {@link Typed} literal; every other tag yields a
 * > language-{@link Tagged} literal.
 *
 * @param text - The tag-to-content map(s) to encode
 *
 * @returns The encoded tagged and plain literals
 */
export function text(text: Some<{ [tag: Tag]: Some<string> }>): readonly (Tagged | Typed)[] {
	return values(text).flatMap(text => Object.entries(text).flatMap(([tag, content]) =>
		values(content).map(value => tag === "und" ? typed(value) : tagged(value, tag))
	));
}

/**
 * Maps each value of a {@link Some} input through an encoder into RDF terms.
 *
 * The shared spine of {@link link} and {@link data}: normalises the input to an array and applies `encoder`
 * elementwise.
 *
 * @typeParam V - The source value type
 * @typeParam T - The {@link Term} subtype produced by `encoder`
 *
 * @param source - The source value(s) to encode
 * @param encoder - Maps a single source value to a term
 *
 * @returns The encoded terms, one per source value
 */
export function term<V, T extends Term>(source: Some<V>, encoder: (value: V) => T): readonly T[] {
	return values(source).map(encoder);
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function values<T>(values: Some<T>): readonly T[] {
	return values === undefined ? [] : new Array<T>().concat(values);
}
