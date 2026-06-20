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
 * N-Triples escaping primitives.
 *
 * Backs the `dsl` module with the {@link escapeIRI} and {@link escapeString} N-Triples escapers.
 *
 * @module
 *
 * @see {@link https://www.w3.org/TR/n-triples/ RDF 1.1 N-Triples}
 */

import { immutable } from "@metreeca/core/deep";


/**
 * Characters requiring a UCHAR escape inside an N-Triples IRIREF production.
 *
 * Matches U+0000–U+0020, `<`, `>`, `"`, `{`, `}`, `|`, `^`, `` ` ``, and `\`, plus every supplementary code point
 * above U+FFFF (each matched as a single unit under the `u` flag).
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-IRIREF N-Triples IRIREF}
 */
const IRIEscapePattern = /[\x00-\x20<>"{}|^`\\]|[\u{10000}-\u{10FFFF}]/gu;

/**
 * Matches every character requiring escaping inside an N-Triples literal.
 *
 * Combines backslash, double-quote, and the C0 control range (U+0000–U+001F) with the supplementary planes
 * (U+10000–U+10FFFF). The single-pass `replace` callback in {@link escapeString} handles each match via {@link Escapes}
 * lookup or numeric `\u`/`\U` formatting.
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-STRING_LITERAL_QUOTE N-Triples STRING_LITERAL_QUOTE}
 */
const StringEscapePattern = /[\\"\x00-\x1f]|[\u{10000}-\u{10FFFF}]/gu;


/**
 * Lookup table mapping N-Triples ECHAR characters to their backslash escape sequences.
 *
 * Covers backslash, double-quote, line feed, carriage return, tab, backspace, and form feed.
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-ECHAR N-Triples ECHAR}
 */
const Escapes: Record<string, string> = immutable({
	"\\": "\\\\",
	"\"": "\\\"",
	"\n": "\\n",
	"\r": "\\r",
	"\t": "\\t",
	"\b": "\\b",
	"\f": "\\f"
});

/**
 * Upper boundary of the Unicode Basic Multilingual Plane.
 *
 * Selects between the four-digit `\uXXXX` and eight-digit `\UXXXXXXXX` N-Triples escape forms: code points within the
 * BMP take the short form, supplementary code points take the long form.
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-UCHAR N-Triples UCHAR}
 */
const BMPRange = 0xFFFF;


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Escapes a string for inclusion in an N-Triples IRIREF.
 *
 * Emits a numeric UCHAR escape for every character the IRIREF production forbids (U+0000–U+0020, `<`, `>`, `"`, `{`,
 * `}`, `|`, `^`, `` ` ``, and `\`) and for every supplementary code point: code points within the BMP take the
 * four-digit `\uXXXX` form, supplementary code points the eight-digit `\UXXXXXXXX` form. All other characters,
 * including the non-ASCII BMP characters the production admits directly, pass through unchanged. Unlike
 * {@link escapeString}, the IRIREF grammar offers no ECHAR shorthands, so every escape is numeric.
 *
 * @param reference The IRI string to escape
 *
 * @returns The escaped string, suitable for inclusion between angle brackets in an N-Triples IRIREF
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-IRIREF N-Triples IRIREF production}
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-UCHAR N-Triples UCHAR production}
 */
export function escapeIRI(reference: string): string {
	return reference.replace(IRIEscapePattern, char => {

		const code = char.codePointAt(0)!;

		return code > BMPRange
			? `\\U${code.toString(16).toUpperCase().padStart(8, "0")}`
			: `\\u${code.toString(16).toUpperCase().padStart(4, "0")}`;

	});
}

/**
 * Escapes a string for inclusion in an N-Triples literal.
 *
 * Replaces backslash, double-quote, and the C0 control characters with their N-Triples ECHAR escapes (`\\`, `\"`,
 * `\n`, `\r`, `\t`, `\b`, `\f`). Remaining code points below U+0020 are emitted as four-digit `\uXXXX` escapes;
 * supplementary code points above U+FFFF are emitted as eight-digit `\UXXXXXXXX` escapes. All other characters,
 * including the single quote, pass through unchanged.
 *
 * @param text The string to escape
 *
 * @returns The escaped string, suitable for inclusion between quotes in an N-Triples literal
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-ECHAR N-Triples ECHAR production}
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-UCHAR N-Triples UCHAR production}
 */
export function escapeString(text: string): string {
	return text.replace(StringEscapePattern, char => {

		if ( char in Escapes ) { return Escapes[char]; } else {

			const code = char.codePointAt(0)!;

			return code > BMPRange
				? `\\U${code.toString(16).toUpperCase().padStart(8, "0")}`
				: `\\u${code.toString(16).toUpperCase().padStart(4, "0")}`;

		}

	});
}
