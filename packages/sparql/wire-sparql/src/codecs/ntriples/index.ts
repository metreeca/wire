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
 * N-Triples codec for the RDF {@link Triple} model.
 *
 * Provides the {@link encodeNTriples | encoder} and {@link decodeNTriples | decoder} translating between the
 * {@link Triple} sequence and its {@link https://www.w3.org/TR/n-triples/ N-Triples} serialisation.
 *
 * @module index
 *
 * @see {@link https://www.w3.org/TR/n-triples/ RDF 1.1 N-Triples}
 */

import { immutable } from "@metreeca/core/deep";
import { createScope } from "@metreeca/core/scope";
import { triple } from "../../dsl.js";
import { blank, reference, type Reference, type Subject, tagged, type Term, type Triple, typed } from "../../index.js";


/**
 * Matches a blank or `#`-prefixed comment line; used to skip non-triple lines during {@link decodeNTriples} iteration.
 */
const CommentPattern = /^\s*(?:#.*)?$/;

/**
 * Matches a UCHAR escape sequence within an N-Triples IRIREF body — the only escape production legal in an IRI.
 * The leading alternative joins a high/low UCHAR pair into a single match so that valid surrogate sequences round-trip
 * to a supplementary code point and isolated surrogate halves fall through to the single-UCHAR branch where they are
 * rejected.
 *
 * Captures: `1` paired high/low surrogate UCHAR hex (`DXXX\uDXXX`), `2` four-digit UCHAR hex (`\uXXXX`), `3`
 * eight-digit UCHAR hex (`\UXXXXXXXX`).
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-UCHAR N-Triples §3 — UCHAR}
 */
const IRIEscapePattern = new RegExp(String.raw`\\(?:`
	+String.raw`u(D[89ABab][0-9A-Fa-f]{2}\\uD[CDEFcdef][0-9A-Fa-f]{2})`
	+String.raw`|u([0-9A-Fa-f]{4})`
	+String.raw`|U([0-9A-Fa-f]{8})`
	+String.raw`)`,
	"g");

/**
 * Matches a UCHAR or ECHAR escape sequence within an N-Triples literal lexical form. The leading alternative joins a
 * high/low UCHAR pair into a single match so that valid surrogate sequences round-trip to a supplementary code point
 * and isolated surrogate halves fall through to the single-UCHAR branch where they are rejected.
 *
 * Captures: `1` paired high/low surrogate UCHAR hex (`DXXX\uDXXX`), `2` four-digit UCHAR hex (`\uXXXX`), `3`
 * eight-digit UCHAR hex (`\UXXXXXXXX`), `4` ECHAR character.
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-ECHAR N-Triples §3 — ECHAR}
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-UCHAR N-Triples §3 — UCHAR}
 */
const LiteralEscapePattern = new RegExp(String.raw`\\(?:`
	+String.raw`u(D[89ABab][0-9A-Fa-f]{2}\\uD[CDEFcdef][0-9A-Fa-f]{2})`
	+String.raw`|u([0-9A-Fa-f]{4})`
	+String.raw`|U([0-9A-Fa-f]{8})`
	+String.raw`|([tbnrf"'\\])`
	+String.raw`)`,
	"g");

/**
 * Matches an N-Triples blank-node label (`_:bX`).
 *
 * Aligned with the `BLANK_NODE_LABEL` production over an ASCII subset of `PN_CHARS`: a leading `PN_CHARS_U` or digit,
 * an optional interior run that may contain `.` and `-`, and a non-`.` trailing character. Restricting the character
 * set to ASCII is sufficient for SPARQL endpoint output and keeps the label self-delimiting, so it stops at the `<`,
 * `"`, or whitespace that opens the next term rather than greedily swallowing it. Embedded as a regex source fragment
 * in {@link TokenPattern}.
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-BLANK_NODE_LABEL N-Triples §3 — BLANK_NODE_LABEL}
 */
const BlankNodePattern = String.raw`_:[A-Za-z0-9_](?:[A-Za-z0-9_.-]*[A-Za-z0-9_-])?`;

/**
 * Matches an IRI reference (`<…>`) or blank-node label (`_:bX`) — the production shared by N-Triples subjects and
 * objects. Embedded as a regex source fragment in {@link TriplePattern}.
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-subject N-Triples §3 — subject}
 */
const TokenPattern = String.raw`<[^>]*>|${BlankNodePattern}`;

/**
 * Matches an IRI reference (`<…>`) — the IRIREF production for N-Triples predicates and literal datatype IRIs.
 * Embedded as a regex source fragment in {@link TriplePattern}.
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-IRIREF N-Triples §3 — IRIREF}
 */
const ReferencePattern = String.raw`<[^>]*>`;

/**
 * Matches a quoted string literal, capturing the (still-escaped) lexical form between the surrounding quotes.
 *
 * Enforces the `STRING_LITERAL_QUOTE` production: the lexical body admits any character other than `"`, `\`, LF, or
 * CR, plus `ECHAR` and `UCHAR` escapes. An unrecognised escape (for example `\z`, `\uWXYZ`) fails the match, so the
 * enclosing {@link TriplePattern} rejects the line rather than passing the bad escape through.
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-STRING_LITERAL_QUOTE N-Triples §3 —
 * 		STRING_LITERAL_QUOTE}
 */
const LexicalPattern = String.raw`"((?:[^"\\\n\r]|\\[tbnrf"'\\]|\\u[0-9A-Fa-f]{4}|\\U[0-9A-Fa-f]{8})*)"`;

/**
 * Matches a literal datatype suffix (`^^<…>`), capturing the datatype IRI body.
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-literal N-Triples §3 — literal}
 */
const DatatypePattern = String.raw`\^\^<([^>]*)>`;

/**
 * Matches a literal language tag (`@lang`), capturing the tag value.
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-LANGTAG N-Triples §3 — LANGTAG}
 */
const LanguagePattern = String.raw`@([A-Za-z]+(?:-[A-Za-z0-9]+)*)`;

/**
 * Matches a complete N-Triples line, including optional trailing whitespace and `#` comment.
 *
 * Captures, in order:
 *
 * 1. subject token (IRI with brackets or `_:` blank-node label)
 * 2. predicate IRI (with brackets)
 * 3. object IRI/blank-node token (`undefined` when the object is a literal)
 * 4. literal lexical form (still escaped)
 * 5. literal datatype IRI body
 * 6. literal language tag
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-triple N-Triples §3 — triple}
 */
const TriplePattern = new RegExp(String.raw`^`
	+String.raw`\s*(${TokenPattern})`
	+String.raw`\s*(${ReferencePattern})`
	+String.raw`\s*(?:(${TokenPattern})|${LexicalPattern}(?:${DatatypePattern}|${LanguagePattern})?)`
	+String.raw`\s*\.\s*(?:#.*)?$`
);

/**
 * Inclusive lower bound of the UTF-16 surrogate range — used to reject UCHAR escapes that would produce a lone or
 * otherwise ill-formed surrogate.
 */
const SurrogateMin = 0xD800;

/**
 * Inclusive upper bound of the UTF-16 surrogate range — see {@link SurrogateMin}.
 */
const SurrogateMax = 0xDFFF;

/**
 * Maps the eight N-Triples ECHAR escape characters to their unescaped form.
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-ECHAR N-Triples §3 — ECHAR}
 */
const ECHAR: Record<string, string> = immutable({

	t: "\t",
	b: "\b",
	n: "\n",
	r: "\r",
	f: "\f",
	"\"": "\"",
	"'": "'",
	"\\": "\\"

});


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Encodes a {@link Triple} sequence into a conformant {@link https://www.w3.org/TR/n-triples/ N-Triples} document.
 *
 * Emits one statement per triple, each terminated by ` .` and a line feed, so the empty sequence encodes to the empty
 * string. Within a statement, terms are rendered per the N-Triples grammar:
 *
 * - IRI {@link Reference}s as `IRIREF`s (`<…>`), with forbidden characters escaped via the IRIREF production;
 * - the `"a"` predicate shorthand expanded to the full `rdf:type` IRIREF;
 * - {@link Blank | blank nodes} as `_:`-prefixed labels carrying the symbol description, which must be a valid
 *   `BLANK_NODE_LABEL` (as produced by {@link decodeNTriples});
 * - datatype-{@link Typed} literals as `"…"^^<datatype>`, or bare `"…"` when no datatype is set;
 * - language-{@link Tagged} literals as `"…"@language`;
 *
 * with literal lexical forms escaped per the `STRING_LITERAL_QUOTE` production.
 *
 * @param triples - The triple sequence to serialise
 *
 * @returns The N-Triples document
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-triple N-Triples §3 — triple}
 */
export function encodeNTriples(triples: readonly Triple[]): string {

	return triples.map(triple).map(line => `${line}\n`).join("");

}

/**
 * Decodes an {@link https://www.w3.org/TR/n-triples/ N-Triples} document into its {@link Triple} sequence.
 *
 * Skips blank lines and `#` comments. Decodes blank-node subjects and objects (`_:bX`) to scope-numbered
 * {@link Blank} labels: a per-document {@link createScope | scope} keyed by the external label maps each distinct
 * label to a short sequential id, so repeats of one label correlate to the same blank node within the document.
 *
 * @param value - The N-Triples document to decode
 *
 * @returns The decoded triple sequence
 *
 * @throws SyntaxError if any non-empty, non-comment line is not a well-formed N-Triples triple, or if a UCHAR
 * 		escape within an IRI or literal expands to an isolated UTF-16 surrogate code point
 */
export function decodeNTriples(value: string): readonly Triple[] {

	const blanks = createScope();

	return value.split(/\r?\n/).flatMap((line, i): readonly Triple[] => {

		if ( CommentPattern.test(line) ) {

			return [];

		} else {

			const match = TriplePattern.exec(line);

			if ( match === null ) {

				throw new SyntaxError(`malformed N-Triples at line ${i+1}: ${line}`);

			} else {

				const s = subject(match[1]);
				const p = iri(match[2]);
				const o = match[3] !== undefined
					? subject(match[3])
					: literal(match[4], match[5], match[6]);

				return [[s, p, o]];

			}

		}

	});


	function subject(token: string): Subject {

		return token.startsWith("_:")
			? blank(blanks.resolve(token.slice(2)))
			: iri(token);

	}

	function iri(token: string): Reference {

		return reference(unescapeIRI(token.slice(1, -1)));

	}

	function literal(lex: string, datatype: string | undefined, language: string | undefined): Term {

		const text = unescapeLiteral(lex);

		if ( language !== undefined ) {

			return tagged(text, language);

		} else if ( datatype !== undefined ) {

			return typed(text, reference(unescapeIRI(datatype)));

		} else {

			return typed(text);

		}

	}


	function unescapeIRI(text: string): string {

		return text.indexOf("\\") < 0 ? text : text.replace(IRIEscapePattern, (_raw, pair, u4, u8) =>

			pair !== undefined ? decodeSurrogate(pair)
				: decodeUchar(u4 ?? u8)
		);

	}

	function unescapeLiteral(text: string): string {

		return text.indexOf("\\") < 0 ? text : text.replace(LiteralEscapePattern, (raw, pair, u4, u8, e) =>

			pair !== undefined ? decodeSurrogate(pair)
				: e !== undefined ? (ECHAR[e] ?? raw)
					: decodeUchar(u4 ?? u8)
		);

	}


	function decodeSurrogate(pair: string): string {

		return String.fromCharCode(parseInt(pair.slice(0, 4), 16), parseInt(pair.slice(-4), 16));

	}

	function decodeUchar(hex: string): string {

		const code = parseInt(hex, 16);

		if ( code >= SurrogateMin && code <= SurrogateMax ) {

			throw new SyntaxError(`surrogate code point in UCHAR escape U+${hex}`);

		} else {

			return String.fromCodePoint(code);

		}

	}

}
