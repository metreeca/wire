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

import { readFileSync } from "fs";
import { describe, expect, test } from "vitest";
import { isBlank, tagged, type Triple, typed } from "../../index.js";
import { decodeNTriples, encodeNTriples } from "./index.js";


describe("encoder", () => {

	test("encodes an IRI triple", () => {

		expect(encodeNTriples([["http://example.com/s", "http://example.com/p", "http://example.com/o"]]))
			.toBe("<http://example.com/s> <http://example.com/p> <http://example.com/o> .\n");

	});

	test("expands the \"a\" predicate to the rdf:type IRI", () => {

		expect(encodeNTriples([["http://example.com/s", "a", "http://example.com/o"]]))
			.toBe("<http://example.com/s> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.com/o> .\n");

	});

	test("encodes a plain literal without datatype", () => {

		expect(encodeNTriples([["http://example.com/s", "http://example.com/p", typed("value")]]))
			.toBe("<http://example.com/s> <http://example.com/p> \"value\" .\n");

	});

	test("encodes a datatype-typed literal", () => {

		expect(encodeNTriples([["http://example.com/s", "http://example.com/p",
			typed("42", "http://www.w3.org/2001/XMLSchema#integer")]]))
			.toBe("<http://example.com/s> <http://example.com/p> "
				+"\"42\"^^<http://www.w3.org/2001/XMLSchema#integer> .\n");

	});

	test("encodes a language-tagged literal", () => {

		expect(encodeNTriples([["http://example.com/s", "http://example.com/p", tagged("hello", "en-GB")]]))
			.toBe("<http://example.com/s> <http://example.com/p> \"hello\"@en-GB .\n");

	});

	test("escapes quotes, backslashes, and control characters in literals", () => {

		expect(encodeNTriples([["http://example.com/s", "http://example.com/p", typed("a\"b\\c\nd")]]))
			.toBe("<http://example.com/s> <http://example.com/p> \"a\\\"b\\\\c\\nd\" .\n");

	});

	test("escapes characters forbidden in an IRI reference", () => {

		expect(encodeNTriples([["http://example.com/\u{1F600}", "http://example.com/p", "http://example.com/o"]]))
			.toBe("<http://example.com/\\U0001F600> <http://example.com/p> <http://example.com/o> .\n");

	});

	test("encodes blank-node subjects and objects, preserving label correlation", () => {

		const node = "_:1";

		expect(encodeNTriples([[node, "http://example.com/p", node]]))
			.toBe("_:1 <http://example.com/p> _:1 .\n");

	});

	test("encodes multiple triples on separate lines", () => {

		expect(encodeNTriples([
			["http://example.com/s1", "http://example.com/p", "http://example.com/o1"],
			["http://example.com/s2", "http://example.com/p", "http://example.com/o2"]
		])).toBe("<http://example.com/s1> <http://example.com/p> <http://example.com/o1> .\n"
			+"<http://example.com/s2> <http://example.com/p> <http://example.com/o2> .\n");

	});

	test("encodes the empty graph as the empty document", () => {

		expect(encodeNTriples([])).toBe("");

	});

});

describe("decoder", () => {

	test("decodes a single IRI triple", () => {

		expect(decodeNTriples("<http://example.com/s> <http://example.com/p> <http://example.com/o> .")).toEqual([
			["http://example.com/s", "http://example.com/p", "http://example.com/o"]
		]);

	});

	test("decodes a plain literal as xsd:string", () => {

		expect(decodeNTriples("<http://example.com/s> <http://example.com/p> \"value\" .")).toEqual([
			["http://example.com/s", "http://example.com/p", typed("value")]
		]);

	});

	test("decodes a datatype-typed literal", () => {

		expect(decodeNTriples(
			"<http://example.com/s> <http://example.com/p> \"42\"^^<http://www.w3.org/2001/XMLSchema#integer> ."
		)).toEqual([
			["http://example.com/s", "http://example.com/p",
				typed("42", "http://www.w3.org/2001/XMLSchema#integer")]
		]);

	});

	test("decodes a language-tagged literal", () => {

		expect(decodeNTriples("<http://example.com/s> <http://example.com/p> \"hello\"@en-GB .")).toEqual([
			["http://example.com/s", "http://example.com/p", tagged("hello", "en-GB")]
		]);

	});

	test("decodes multiple triples across lines", () => {

		expect(decodeNTriples([
			"<http://example.com/s1> <http://example.com/p> <http://example.com/o1> .",
			"<http://example.com/s2> <http://example.com/p> <http://example.com/o2> ."
		].join("\n"))).toHaveLength(2);

	});

	test("skips blank lines and comments", () => {

		expect(decodeNTriples([
			"# leading comment",
			"",
			"<http://example.com/s> <http://example.com/p> <http://example.com/o> .",
			"   # indented comment",
			""
		].join("\n"))).toHaveLength(1);

	});

	test("decodes ECHAR escape sequences in literal text", () => {

		expect(decodeNTriples(
			"<http://example.com/s> <http://example.com/p> \"line1\\nline2\\ttab\\\"quote\\\\back\" ."
		)).toEqual([
			["http://example.com/s", "http://example.com/p", typed("line1\nline2\ttab\"quote\\back")]
		]);

	});

	test("decodes UCHAR escapes in IRIs and literals", () => {

		expect(decodeNTriples("<http://example.com/\\u00E9> <http://p> \"caf\\u00E9\" .")).toEqual([
			["http://example.com/é", "http://p", typed("café")]
		]);

	});

	test("decodes a blank-node subject to a scope-numbered Blank", () => {

		const subject = decodeNTriples("_:b1 <http://p> <http://o> .")[0][0];

		expect(isBlank(subject) && subject).toBe("_:0");

	});

	test("decodes a blank-node object to a scope-numbered Blank", () => {

		const object = decodeNTriples("<http://s> <http://p> _:b1 .")[0][2];

		expect(isBlank(object) && object).toBe("_:0");

	});

	test("correlates repeats of one external label to the same Blank", () => {

		const [subject, , object] = decodeNTriples("_:b1 <http://p> _:b1 .")[0];

		expect(subject).toBe(object);

	});

	test("numbers distinct external labels distinctly", () => {

		const [subject, , object] = decodeNTriples("_:a <http://p> _:b .")[0];

		expect([subject, object]).toEqual(["_:0", "_:1"]);

	});

	test("rejects a malformed language tag", () => {

		expect(() => decodeNTriples("<http://s> <http://p> \"x\"@en- .")).toThrow(SyntaxError);

	});

	test("rejects a malformed line", () => {

		expect(() => decodeNTriples("not a triple")).toThrow(SyntaxError);

	});

});

describe("decoder W3C", () => {

	const suite = new URL("./w3c-suite/", import.meta.url);

	const manifest = readFileSync(new URL("manifest.ttl", suite), "utf-8");

	const entries = Array.from(manifest.matchAll(
		/<#[^>]+>\s+rdf:type\s+rdft:TestNTriples(Positive|Negative)Syntax\s*;[\s\S]*?mf:action\s+<([^>]+)>/g
	)).map(([, kind, action]) => ({ kind, action }));

	const positives = entries.filter(entry => entry.kind === "Positive").map(entry => entry.action);
	const negatives = entries.filter(entry => entry.kind === "Negative").map(entry => entry.action);

	const read = (action: string): string => readFileSync(new URL(action, suite), "utf-8");

	test("manifest enumerates the full suite", () => {

		expect(positives).toHaveLength(41);
		expect(negatives).toHaveLength(29);

	});

	test.each(positives)("parses positive syntax %s", action => {

		expect(() => decodeNTriples(read(action))).not.toThrow();

	});

	test.each(negatives)("rejects negative syntax %s", action => {

		expect(() => decodeNTriples(read(action))).toThrow();

	});

});

describe("round-trip", () => {

	test("re-parses encoded output back to the original model", () => {

		const triples: readonly Triple[] = [
			["http://example.com/s", "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", "http://example.com/o"],
			["http://example.com/s", "http://example.com/p", typed("value")],
			["http://example.com/s", "http://example.com/p", typed("42", "http://www.w3.org/2001/XMLSchema#integer")],
			["http://example.com/s", "http://example.com/p", tagged("hello", "en")]
		];

		expect(decodeNTriples(encodeNTriples(triples))).toEqual(triples);

	});

	test("is idempotent through a decode/encode cycle with blank nodes", () => {

		const document = encodeNTriples([["_:0", "http://example.com/p", typed("x")]]);

		expect(encodeNTriples(decodeNTriples(document))).toBe(document);

	});

});
