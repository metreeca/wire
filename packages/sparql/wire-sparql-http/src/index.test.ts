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

import { blank, named, tagged, typed } from "@metreeca/trio";
import { describe, expect, test } from "vitest";
import { decodeTerm, decodeTuples } from "./index.core.js";


describe("bindings", () => {

	test("decodes an empty result set", () => {

		expect(decodeTuples({ results: { bindings: [] } })).toEqual([]);

	});

	test("decodes a row with numeric variable indices", () => {

		expect(decodeTuples({
			results: {
				bindings: [{
					"0": { type: "uri", value: "http://example.com/s" },
					"1": { type: "literal", value: "v" }
				}]
			}
		})).toEqual([
			{ "?0": named("http://example.com/s"), "?1": typed("v") }
		]);

	});

	test("decodes a string variable name", () => {

		expect(decodeTuples({
			results: {
				bindings: [{
					"v0": { type: "uri", value: "http://example.com/" }
				}]
			}
		})).toEqual([
			{ "?v0": named("http://example.com/") }
		]);

	});

	test("rejects a malformed variable name", () => {

		expect(() => decodeTuples({
			results: {
				bindings: [{
					"a b": { type: "uri", value: "http://example.com/" }
				}]
			}
		})).toThrow(RangeError);

	});

});

describe("named", () => {

	test("boxes an IRI into a named resource", () => {

		expect(named("http://example.com/")).toEqual({ kind: "named", iri: "http://example.com/" });

	});

	test("rejects a blank-node label", () => {

		expect(() => named("_:b1")).toThrow(RangeError);

	});

});

describe("term", () => {

	test("decodes a uri binding", () => {

		expect(decodeTerm({ type: "uri", value: "http://example.com/" })).toEqual(named("http://example.com/"));

	});

	test("decodes a plain literal as xsd:string", () => {

		expect(decodeTerm({ type: "literal", value: "v" })).toEqual(typed("v"));

	});

	test("decodes a datatype-typed literal", () => {

		expect(decodeTerm({
			type: "literal",
			value: "42",
			datatype: "http://www.w3.org/2001/XMLSchema#integer"
		})).toEqual(typed("42", "http://www.w3.org/2001/XMLSchema#integer"));

	});

	test("decodes a language-tagged literal via xml:lang", () => {

		expect(decodeTerm({ type: "literal", value: "hi", "xml:lang": "en" })).toEqual(tagged("hi", "en"));

	});

	test("decodes a language-tagged literal via lang", () => {

		expect(decodeTerm({ type: "literal", value: "hi", lang: "en" })).toEqual(tagged("hi", "en"));

	});

	test("decodes a legacy typed-literal", () => {

		expect(decodeTerm({
			type: "typed-literal",
			value: "42",
			datatype: "http://www.w3.org/2001/XMLSchema#integer"
		})).toEqual(typed("42", "http://www.w3.org/2001/XMLSchema#integer"));

	});

	test("rejects a uri binding holding a blank-node label", () => {

		expect(() => decodeTerm({ type: "uri", value: "_:b1" })).toThrow(RangeError);

	});

	test("decodes a bnode binding to a scope-numbered Blank", () => {

		const decoded = decodeTerm({ type: "bnode", value: "b1" });

		expect(decoded).toEqual(blank(0));

	});

});
