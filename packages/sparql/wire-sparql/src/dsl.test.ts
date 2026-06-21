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

import { describe, expect, it } from "vitest";
import { escapeIRI, escapeString } from "./dsl.core.js";
import { anchor, blank, literal, reference, tagged, term, typed, variable } from "./dsl.js";


describe("terms", () => {

	describe("anchor", () => {

		it("should render a variable verbatim", async () => {
			expect(anchor("?0")).toBe("?0");
		});

		it("should serialise a term", async () => {
			expect(anchor("http://example.org/x")).toBe("<http://example.org/x>");
		});

	});

	describe("variable", () => {

		it("should render the variable token verbatim", async () => {
			expect(variable("?0")).toBe("?0");
		});

	});

	describe("term", () => {

		it("should serialise a blank node", async () => {
			expect(term("_:b0")).toBe("_:b0");
		});

		it("should serialise an IRI reference", async () => {
			expect(term("http://example.org/x")).toBe("<http://example.org/x>");
		});

		it("should serialise a language-tagged literal", async () => {
			expect(term({ text: "hello", language: "en" })).toBe("\"hello\"@en");
		});

		it("should serialise a datatype-typed literal", async () => {
			expect(term({ text: "42", datatype: "http://www.w3.org/2001/XMLSchema#integer" }))
				.toBe("\"42\"^^<http://www.w3.org/2001/XMLSchema#integer>");
		});

		it("should serialise a simple literal when datatype is absent", async () => {
			expect(term({ text: "hello" })).toBe("\"hello\"");
		});

	});

	describe("blank", () => {

		it("should render the blank label verbatim", async () => {
			expect(blank("_:b0")).toBe("_:b0");
		});

		it("should mint a fresh label when no argument is provided", async () => {
			expect(blank()).toMatch(/^_:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
		});

		it("should mint a distinct label on each call", async () => {
			expect(blank()).not.toBe(blank());
		});

	});

	describe("reference", () => {

		it("should wrap IRI in angle brackets", async () => {
			expect(reference("http://example.org/x")).toBe("<http://example.org/x>");
		});

		it("should escape forbidden characters in IRI", async () => {
			expect(reference("http://example.org/a b")).toBe("<http://example.org/a\\u0020b>");
		});

		it("should mint fresh urn:uuid reference when no argument is provided", async () => {
			expect(reference()).toMatch(/^<urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>$/);
		});

		it("should mint a distinct reference on each call", async () => {
			expect(reference()).not.toBe(reference());
		});

	});

	describe("literal", () => {

		it("should produce simple literal in double quotes when type is omitted", async () => {
			expect(literal("hello")).toBe("\"hello\"");
		});

		it("should produce simple literal in double quotes when type is xsd:string", async () => {
			expect(literal("hello", "http://www.w3.org/2001/XMLSchema#string")).toBe("\"hello\"");
		});

		it("should dispatch to language-tagged form for BCP 47 tag", async () => {
			expect(literal("hello", "en")).toBe("\"hello\"@en");
		});

		it("should dispatch to typed form for datatype IRI", async () => {
			expect(literal("42", "http://www.w3.org/2001/XMLSchema#integer"))
				.toBe("\"42\"^^<http://www.w3.org/2001/XMLSchema#integer>");
		});

		it("should escape text in simple literal", async () => {
			expect(literal("a\\b")).toBe("\"a\\\\b\"");
		});

	});

	describe("tagged", () => {

		it("should serialise language-tagged literal", async () => {
			expect(tagged("hello", "en")).toBe("\"hello\"@en");
		});

		it("should escape text in language-tagged literal", async () => {
			expect(tagged("say \"hello\"", "en")).toBe("\"say \\\"hello\\\"\"@en");
		});

	});

	describe("typed", () => {

		it("should serialise typed literal with datatype IRI", async () => {
			expect(typed("42", "http://www.w3.org/2001/XMLSchema#integer"))
				.toBe("\"42\"^^<http://www.w3.org/2001/XMLSchema#integer>");
		});

		it("should escape text in typed literal", async () => {
			expect(typed("a\\b", "http://www.w3.org/2001/XMLSchema#integer"))
				.toBe("\"a\\\\b\"^^<http://www.w3.org/2001/XMLSchema#integer>");
		});

	});

});

describe("escape", () => {

	describe("escapeIRI", () => {

		it("should escape forbidden characters with unicode escapes", async () => {
			expect(escapeIRI("a b")).toBe("a\\u0020b");
		});

		it("should escape control characters with unicode escapes", async () => {
			expect(escapeIRI("a\tb")).toBe("a\\u0009b");
		});

		it("should escape backslash", async () => {
			expect(escapeIRI("a\\b")).toBe("a\\u005Cb");
		});

		it("should escape angle brackets", async () => {
			expect(escapeIRI("a<b>c")).toBe("a\\u003Cb\\u003Ec");
		});

		it("should escape double quote", async () => {
			expect(escapeIRI("a\"b")).toBe("a\\u0022b");
		});

		it("should escape supplementary plane characters with uppercase form", async () => {
			expect(escapeIRI("\u{1F600}")).toBe("\\U0001F600");
		});

		it("should leave printable ASCII unchanged", async () => {
			expect(escapeIRI("http://example.org/x")).toBe("http://example.org/x");
		});

		it("should leave non-ASCII BMP characters unchanged", async () => {
			expect(escapeIRI("é世")).toBe("é世");
		});

		it("should handle empty string", async () => {
			expect(escapeIRI("")).toBe("");
		});

	});

	describe("escapeString", () => {

		it("should escape backslash", async () => {
			expect(escapeString("a\\b")).toBe("a\\\\b");
		});

		it("should escape double quote", async () => {
			expect(escapeString("say \"hello\"")).toBe("say \\\"hello\\\"");
		});

		it("should escape newline", async () => {
			expect(escapeString("line1\nline2")).toBe("line1\\nline2");
		});

		it("should escape carriage return", async () => {
			expect(escapeString("line1\rline2")).toBe("line1\\rline2");
		});

		it("should escape tab", async () => {
			expect(escapeString("a\tb")).toBe("a\\tb");
		});

		it("should escape backspace", async () => {
			expect(escapeString("a\bb")).toBe("a\\bb");
		});

		it("should escape form feed", async () => {
			expect(escapeString("a\fb")).toBe("a\\fb");
		});

		it("should escape control characters with unicode escapes", async () => {
			expect(escapeString("ab")).toBe("a\\u0001b");
		});

		it("should escape supplementary plane characters with uppercase form", async () => {
			expect(escapeString("smile \u{1F600}")).toBe("smile \\U0001F600");
		});

		it("should leave printable ASCII unchanged", async () => {
			expect(escapeString("Hello, World! 123")).toBe("Hello, World! 123");
		});

		it("should leave non-ASCII BMP characters unchanged", async () => {
			expect(escapeString("é世")).toBe("é世");
		});

		it("should leave single quote unchanged", async () => {
			expect(escapeString("it's")).toBe("it's");
		});

		it("should handle empty string", async () => {
			expect(escapeString("")).toBe("");
		});

	});

});
