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
 * SPARQL Results JSON wire types and decoders.
 *
 * Backs the `index` module with the {@link SPARQLBoolean}, {@link SPARQLBindings}, and {@link SPARQLBinding}
 * wire-document types and the {@link decodeTuples} and {@link decodeTerm} decoders that translate SPARQL 1.1 Query
 * Results JSON into the {@link @metreeca/wire-sparql!index.Tuple | Tuple} and {@link @metreeca/trio!Term | Term}
 * model.
 *
 * @module
 *
 * @see {@link https://www.w3.org/TR/sparql11-results-json/ SPARQL 1.1 Query Results JSON Format}
 */

import { createScope, type Scope } from "@metreeca/core/scope";
import { type Blank, blank, named, tagged, type Term, typed } from "@metreeca/trio";
import { type Tuple, variable } from "@metreeca/wire-sparql";


/**
 * Boolean Results document for an `ASK` query, encoded in the SPARQL 1.1 Query Results JSON Format.
 *
 * @see {@link https://www.w3.org/TR/sparql11-results-json/#ask SPARQL Results JSON §3.2 — Boolean Results}
 */
export type SPARQLBoolean = {

	readonly boolean: boolean;

};

/**
 * Variable Binding Results document for a `SELECT` query, encoded in the SPARQL 1.1 Query Results JSON Format.
 *
 * Restricted to the `results.bindings` projection: `head.vars` is intentionally omitted because the
 * {@link Tuple} surface carries the variable identity through the row keys.
 *
 * @see {@link https://www.w3.org/TR/sparql11-results-json/#select SPARQL Results JSON §3.1 — Variable Binding Results}
 */
export type SPARQLBindings = {

	readonly results: {

		readonly bindings: ReadonlyArray<{

			readonly [variable: string]: SPARQLBinding;

		}>;

	};

};

/**
 * RDF term in the SPARQL Results JSON wire encoding.
 *
 * Tolerates two legacy endpoint quirks: language tags may arrive under either `xml:lang` (canonical) or `lang`, and
 * the `typed-literal` value of `type` is accepted as an alias of `literal`.
 *
 * @see {@link https://www.w3.org/TR/sparql11-results-json/#select-encode-terms SPARQL Results JSON
 * 		— Encoding RDF Terms}
 */
export type SPARQLBinding = {

	readonly type: "uri" | "literal" | "typed-literal" | "bnode";
	readonly value: string;
	readonly "xml:lang"?: string;
	readonly lang?: string;
	readonly datatype?: string;

};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Decodes a {@link SPARQLBindings} value into the {@link Tuple} sequence produced for SPARQL `SELECT` results.
 *
 * Variable names are decoded from the wire string keys into {@link @metreeca/wire-sparql!index.Variable | Variable}
 * tokens via {@link variable}. A single blank-node {@link createScope | scope}, shared across all rows, correlates
 * `bnode` labels over the whole result set.
 *
 * @param value - Wire representation of a `SELECT` result set
 *
 * @returns The decoded solution sequence
 *
 * @throws RangeError if any variable name fails {@link variable} decoding or any binding fails
 * {@link decodeTerm} decoding
 */
export function decodeTuples(value: SPARQLBindings): readonly Tuple[] {

	const blanks = createScope(blank);

	return value.results.bindings.map(row => Object.fromEntries(
		Object.entries(row).map(([name, binding]) => [variable(name), decodeTerm(binding, blanks)])
	));

}

/**
 * Decodes a {@link SPARQLBinding} into an RDF {@link Term}.
 *
 * Decodes a `bnode` binding to a scope-numbered {@link @metreeca/trio!Blank | Blank}, minting one node per distinct
 * label from `blanks` so repeats of one label correlate to the same node. The `uri` value is validated through
 * {@link named}, and a literal's lexical form, language tag and `datatype` IRI through {@link tagged} and
 * {@link typed}, while an unrecognised `type` is rejected.
 *
 * @param value - Wire representation of an RDF term
 * @param blanks - The blank-node {@link Scope} correlating `bnode` labels; defaults to a fresh per-call scope
 *
 * @returns The decoded term
 *
 * @throws RangeError if `value.type` is unsupported, if the `uri` value or a `datatype` IRI is relative or malformed,
 * if a lexical form holds an isolated UTF-16 surrogate code point, or if a language tag is not well-formed BCP 47
 */
export function decodeTerm(value: SPARQLBinding, blanks: Scope<Blank> = createScope(blank)): Term {

	if ( value.type === "bnode" ) {

		return blanks.resolve(value.value);

	} else if ( value.type === "uri" ) {

		return named(value.value);

	} else if ( value.type === "literal" || value.type === "typed-literal" ) {

		const language = value["xml:lang"] ?? value.lang;

		if ( language !== undefined ) {

			return tagged(value.value, language);

		} else if ( value.datatype !== undefined ) {

			return typed(value.value, value.datatype);

		} else {

			return typed(value.value);

		}

	} else {

		throw new RangeError(`unsupported term type <${value.type}>`);

	}

}
