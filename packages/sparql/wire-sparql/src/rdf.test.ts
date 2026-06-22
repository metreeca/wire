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

import { xsd } from "@metreeca/core/resource";
import { describe, expect, test } from "vitest";
import { tagged, typed } from "./index.js";
import { data, describe as describeResource, link, property, resource, term, text } from "./rdf.js";


const s = "https://example.com/s";
const p = "https://example.com/p";
const o = "https://example.com/o";


describe("describe", () => {

	test("threads the subject into the builder and returns its graph", async () => {
		expect(describeResource(s, subject => property(subject, p, typed("v")))).toEqual([
			[s, p, typed("v")]
		]);
	});

});

describe("resource", () => {

	test("concatenates property graphs into one flat graph", async () => {
		expect(resource(property(s, p, typed("a")), property(s, p, typed("b")))).toEqual([
			[s, p, typed("a")],
			[s, p, typed("b")]
		]);
	});

	test("yields the empty graph for no properties", async () => {
		expect(resource()).toEqual([]);
	});

});

describe("property", () => {

	describe("direct form", () => {

		test("links each subject to each object as one triple per pair", async () => {
			expect(property(s, p, typed("v"))).toEqual([
				[s, p, typed("v")]
			]);
			expect(property([s, o], p, typed("v"))).toEqual([
				[s, p, typed("v")],
				[o, p, typed("v")]
			]);
		});

		test("normalises an absent subject or object to no triples", async () => {
			expect(property(undefined, p, typed("v"))).toEqual([]);
			expect(property(s, p, undefined)).toEqual([]);
		});

	});

	describe("encoded form", () => {

		test("uses a term result as a direct triple object", async () => {
			expect(property(s, p, ["v"], value => typed(value))).toEqual([
				[s, p, typed("v")]
			]);
		});

		test("embeds a graph result and links it at its derived root", async () => {
			expect(property(s, p, ["v"], value => [["_:b", o, typed(value)]])).toEqual([
				[s, p, "_:b"],
				["_:b", o, typed("v")]
			]);
		});

		test("contributes nothing for an empty encoded graph", async () => {
			expect(property(s, p, ["v"], () => [])).toEqual([]);
		});

		test("throws on a cyclic encoded graph with no root subject", async () => {
			expect(() => property(s, p, ["v"], () => [["_:a", p, "_:b"], ["_:b", p, "_:a"]]))
				.toThrow(RangeError);
		});

		test("throws on a disconnected encoded graph with multiple root subjects", async () => {
			expect(() => property(s, p, ["v"], () => [["_:a", p, typed("x")], ["_:b", p, typed("y")]]))
				.toThrow(RangeError);
		});

	});

});

describe("link", () => {

	test("encodes references as IRI terms", async () => {
		expect(link(s)).toEqual([s]);
		expect(link([s, o])).toEqual([s, o]);
	});

	test("normalises an absent reference to no terms", async () => {
		expect(link(undefined)).toEqual([]);
	});

});

describe("data", () => {

	test("encodes scalars as plain literals without a datatype", async () => {
		expect(data("v")).toEqual([typed("v")]);
		expect(data([1, 2])).toEqual([typed("1"), typed("2")]);
	});

	test("attaches the supplied datatype", async () => {
		expect(data(42, xsd.integer)).toEqual([typed("42", xsd.integer)]);
	});

	test("normalises an absent value to no terms", async () => {
		expect(data(undefined)).toEqual([]);
	});

});

describe("text", () => {

	test("encodes tagged content as language-tagged literals", async () => {
		expect(text({ en: "hello", it: "ciao" })).toEqual([
			tagged("hello", "en"),
			tagged("ciao", "it")
		]);
	});

	test("encodes the und tag as a plain literal", async () => {
		expect(text({ und: "plain" })).toEqual([typed("plain")]);
	});

	test("expands multi-valued content under a tag", async () => {
		expect(text({ en: ["a", "b"] })).toEqual([
			tagged("a", "en"),
			tagged("b", "en")
		]);
	});

	test("normalises an absent map to no terms", async () => {
		expect(text(undefined)).toEqual([]);
	});

});

describe("term", () => {

	test("applies the encoder to each value of the input", async () => {
		expect(term(["a", "b"], value => typed(value))).toEqual([typed("a"), typed("b")]);
	});

	test("normalises an absent input to no terms", async () => {
		expect(term(undefined, (value: string) => typed(value))).toEqual([]);
	});

});
