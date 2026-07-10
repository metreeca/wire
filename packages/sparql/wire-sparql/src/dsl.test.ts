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
import {
	abs,
	add,
	alt,
	and,
	anchor,
	blank,
	bnode,
	boolean,
	call,
	ceil,
	coalesce,
	concat,
	contains,
	day,
	div,
	encodeForUri,
	exists,
	floor,
	fragment,
	graph,
	group,
	groupBy,
	having,
	hours,
	iri,
	isIn,
	isNotIn,
	lcase,
	limit,
	literal,
	md5,
	minus,
	minutes,
	month,
	mul,
	nexists,
	nil,
	none,
	now,
	number,
	offset,
	optional,
	or,
	orderBy,
	rand,
	reference,
	regex,
	replace,
	round,
	seconds,
	seq,
	sha1,
	sha256,
	sha384,
	sha512,
	service,
	strafter,
	strbefore,
	strdt,
	strends,
	strlang,
	strlen,
	strstarts,
	string,
	struuid,
	sub,
	substr,
	tagged,
	term,
	timezone,
	typed,
	tz,
	ucase,
	union,
	update,
	uuid,
	values,
	variable,
	where,
	year
} from "./dsl.js";


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

	describe("boolean", () => {

		it("should render true as the SPARQL keyword", async () => {
			expect(boolean(true)).toBe("true");
		});

		it("should render false as the SPARQL keyword", async () => {
			expect(boolean(false)).toBe("false");
		});

	});

	describe("number", () => {

		it("should render an integer as a bare xsd:integer literal", async () => {
			expect(number(42)).toBe("42");
		});

		it("should render a negative integer", async () => {
			expect(number(-42)).toBe("-42");
		});

		it("should render zero", async () => {
			expect(number(0)).toBe("0");
		});

		it("should render a non-integer as a bare xsd:decimal literal", async () => {
			expect(number(4.2)).toBe("4.2");
		});

		it("should render a small magnitude as a bare xsd:double literal", async () => {
			expect(number(0.0000001)).toBe("1e-7");
		});

		it("should render positive infinity as a typed xsd:double literal", async () => {
			expect(number(Infinity)).toBe("\"INF\"^^<http://www.w3.org/2001/XMLSchema#double>");
		});

		it("should render negative infinity as a typed xsd:double literal", async () => {
			expect(number(-Infinity)).toBe("\"-INF\"^^<http://www.w3.org/2001/XMLSchema#double>");
		});

		it("should render NaN as a typed xsd:double literal", async () => {
			expect(number(NaN)).toBe("\"NaN\"^^<http://www.w3.org/2001/XMLSchema#double>");
		});

	});

	describe("string", () => {

		it("should render a simple literal in double quotes", async () => {
			expect(string("hello")).toBe("\"hello\"");
		});

		it("should escape text in the simple literal", async () => {
			expect(string("a\\b")).toBe("\"a\\\\b\"");
		});

		it("should handle empty string", async () => {
			expect(string("")).toBe("\"\"");
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

describe("arithmetic operators", () => {

	describe("add", () => {
		it("should render a parenthesised sum", async () => {
			expect(add("?x", "?y")).toBe("(?x + ?y)");
		});
	});

	describe("sub", () => {
		it("should render a parenthesised difference", async () => {
			expect(sub("?x", "?y")).toBe("(?x - ?y)");
		});
	});

	describe("mul", () => {
		it("should render a parenthesised product", async () => {
			expect(mul("?x", "?y")).toBe("(?x * ?y)");
		});
	});

	describe("div", () => {
		it("should render a parenthesised quotient", async () => {
			expect(div("?x", "?y")).toBe("(?x / ?y)");
		});
	});

});

describe("term constructors", () => {

	describe("iri", () => {
		it("should render an iri call", async () => {
			expect(iri("?s")).toBe("iri(?s)");
		});
	});

	describe("bnode", () => {
		it("should render a nullary bnode call when the argument is omitted", async () => {
			expect(bnode()).toBe("bnode()");
		});
		it("should render a bnode call over the correlating argument", async () => {
			expect(bnode("?x")).toBe("bnode(?x)");
		});
	});

	describe("strdt", () => {
		it("should render a strdt call pairing lexical form and datatype", async () => {
			expect(strdt("?v", "?d")).toBe("strdt(?v, ?d)");
		});
	});

	describe("strlang", () => {
		it("should render a strlang call pairing lexical form and language", async () => {
			expect(strlang("?v", "?l")).toBe("strlang(?v, ?l)");
		});
	});

	describe("uuid", () => {
		it("should render a nullary uuid call", async () => {
			expect(uuid()).toBe("uuid()");
		});
	});

	describe("struuid", () => {
		it("should render a nullary struuid call", async () => {
			expect(struuid()).toBe("struuid()");
		});
	});

});

describe("string functions", () => {

	describe("strlen", () => {
		it("should render a strlen call", async () => {
			expect(strlen("?s")).toBe("strlen(?s)");
		});
	});

	describe("substr", () => {
		it("should render a two-argument substr call when length is omitted", async () => {
			expect(substr("?s", "2")).toBe("substr(?s, 2)");
		});
		it("should render a three-argument substr call when length is supplied", async () => {
			expect(substr("?s", "2", "4")).toBe("substr(?s, 2, 4)");
		});
	});

	describe("ucase", () => {
		it("should render a ucase call", async () => {
			expect(ucase("?s")).toBe("ucase(?s)");
		});
	});

	describe("lcase", () => {
		it("should render an lcase call", async () => {
			expect(lcase("?s")).toBe("lcase(?s)");
		});
	});

	describe("strstarts", () => {
		it("should render a strstarts call", async () => {
			expect(strstarts("?s", "?p")).toBe("strstarts(?s, ?p)");
		});
	});

	describe("strends", () => {
		it("should render a strends call", async () => {
			expect(strends("?s", "?p")).toBe("strends(?s, ?p)");
		});
	});

	describe("contains", () => {
		it("should render a contains call", async () => {
			expect(contains("?s", "?p")).toBe("contains(?s, ?p)");
		});
	});

	describe("strbefore", () => {
		it("should render a strbefore call", async () => {
			expect(strbefore("?s", "?p")).toBe("strbefore(?s, ?p)");
		});
	});

	describe("strafter", () => {
		it("should render a strafter call", async () => {
			expect(strafter("?s", "?p")).toBe("strafter(?s, ?p)");
		});
	});

	describe("encodeForUri", () => {
		it("should render an encode_for_uri call", async () => {
			expect(encodeForUri("?s")).toBe("encode_for_uri(?s)");
		});
	});

	describe("concat", () => {
		it("should render a concat call over the joined arguments", async () => {
			expect(concat("?a", "?b")).toBe("concat(?a, ?b)");
		});
		it("should render an empty concat call for no arguments", async () => {
			expect(concat()).toBe("concat()");
		});
	});

	describe("regex", () => {
		it("should render a two-argument regex call when flags are omitted", async () => {
			expect(regex("?s", "?p")).toBe("regex(?s, ?p)");
		});
		it("should render a three-argument regex call when flags are supplied", async () => {
			expect(regex("?s", "?p", "?f")).toBe("regex(?s, ?p, ?f)");
		});
	});

	describe("replace", () => {
		it("should render a three-argument replace call when flags are omitted", async () => {
			expect(replace("?s", "?p", "?r")).toBe("replace(?s, ?p, ?r)");
		});
		it("should render a four-argument replace call when flags are supplied", async () => {
			expect(replace("?s", "?p", "?r", "?f")).toBe("replace(?s, ?p, ?r, ?f)");
		});
	});

});

describe("numeric functions", () => {

	describe("abs", () => {
		it("should render an abs call", async () => {
			expect(abs("?n")).toBe("abs(?n)");
		});
	});

	describe("round", () => {
		it("should render a round call", async () => {
			expect(round("?n")).toBe("round(?n)");
		});
	});

	describe("ceil", () => {
		it("should render a ceil call", async () => {
			expect(ceil("?n")).toBe("ceil(?n)");
		});
	});

	describe("floor", () => {
		it("should render a floor call", async () => {
			expect(floor("?n")).toBe("floor(?n)");
		});
	});

	describe("rand", () => {
		it("should render a nullary rand call", async () => {
			expect(rand()).toBe("rand()");
		});
	});

});

describe("temporal functions", () => {

	describe("now", () => {
		it("should render a nullary now call", async () => {
			expect(now()).toBe("now()");
		});
	});

	describe("year", () => {
		it("should render a year call", async () => {
			expect(year("?d")).toBe("year(?d)");
		});
	});

	describe("month", () => {
		it("should render a month call", async () => {
			expect(month("?d")).toBe("month(?d)");
		});
	});

	describe("day", () => {
		it("should render a day call", async () => {
			expect(day("?d")).toBe("day(?d)");
		});
	});

	describe("hours", () => {
		it("should render an hours call", async () => {
			expect(hours("?d")).toBe("hours(?d)");
		});
	});

	describe("minutes", () => {
		it("should render a minutes call", async () => {
			expect(minutes("?d")).toBe("minutes(?d)");
		});
	});

	describe("seconds", () => {
		it("should render a seconds call", async () => {
			expect(seconds("?d")).toBe("seconds(?d)");
		});
	});

	describe("timezone", () => {
		it("should render a timezone call", async () => {
			expect(timezone("?d")).toBe("timezone(?d)");
		});
	});

	describe("tz", () => {
		it("should render a tz call", async () => {
			expect(tz("?d")).toBe("tz(?d)");
		});
	});

});

describe("hash functions", () => {

	describe("md5", () => {
		it("should render an md5 call", async () => {
			expect(md5("?s")).toBe("md5(?s)");
		});
	});

	describe("sha1", () => {
		it("should render a sha1 call", async () => {
			expect(sha1("?s")).toBe("sha1(?s)");
		});
	});

	describe("sha256", () => {
		it("should render a sha256 call", async () => {
			expect(sha256("?s")).toBe("sha256(?s)");
		});
	});

	describe("sha384", () => {
		it("should render a sha384 call", async () => {
			expect(sha384("?s")).toBe("sha384(?s)");
		});
	});

	describe("sha512", () => {
		it("should render a sha512 call", async () => {
			expect(sha512("?s")).toBe("sha512(?s)");
		});
	});

});

describe("isNotIn", () => {

	it("should render a not-in membership test over the joined options", async () => {
		expect(isNotIn("?x", ["?a", "?b"])).toBe("?x not in (?a, ?b)");
	});

	it("should render an empty not-in test for no options", async () => {
		expect(isNotIn("?x", [])).toBe("?x not in ()");
	});

});

describe("having", () => {

	it("should wrap a single condition in a having clause", async () => {
		expect(having(["?count > 10"])).toBe("having (?count > 10)");
	});

	it("should bracket and conjoin several conditions with &&", async () => {
		expect(having(["?count > 10", "?sum < 100"])).toBe("having ((?count > 10) && (?sum < 100))");
	});

	it("should yield the empty fragment for no conditions", async () => {
		expect(having([])).toBe("");
	});

});

describe("limit", () => {

	it("should render the limit clause for a positive count", async () => {
		expect(limit(10)).toBe("limit 10");
	});

	it("should yield the empty fragment for a count of zero", async () => {
		expect(limit(0)).toBe("");
	});

});

describe("offset", () => {

	it("should render the offset clause for a positive start", async () => {
		expect(offset(10)).toBe("offset 10");
	});

	it("should yield the empty fragment for a start of zero", async () => {
		expect(offset(0)).toBe("");
	});

});

describe("fragment", () => {

	it("should space-join the clauses", async () => {
		expect(fragment("a", "b", "c")).toBe("a b c");
	});

	it("should drop empty clauses to avoid redundant spaces", async () => {
		expect(fragment("a", nil(), "b")).toBe("a b");
	});

	it("should drop leading and trailing empty clauses", async () => {
		expect(fragment(nil(), "a", nil())).toBe("a");
	});

	it("should yield the empty fragment when every clause is empty", async () => {
		expect(fragment(nil(), nil())).toBe("");
	});

});

describe("update", () => {

	it("should join the operations with a separator", async () => {
		expect(update("a", "b", "c")).toBe("a; b; c");
	});

	it("should drop empty operations to avoid redundant separators", async () => {
		expect(update("a", nil(), "b")).toBe("a; b");
	});

	it("should yield the empty request when every operation is empty", async () => {
		expect(update(nil(), nil())).toBe("");
	});

});

describe("empty clause filtering", () => {

	it("should drop empty clauses in union", async () => {
		expect(union("a", nil(), "b")).toBe("{ a } union { b }");
		expect(union("a", nil())).toBe("a");
	});

	it("should drop empty elements in seq", async () => {
		expect(seq("a", nil(), "b")).toBe("a/b");
	});

	it("should drop empty elements in alt", async () => {
		expect(alt("a", nil(), "b")).toBe("a|b");
	});

	it("should drop empty predicates in none", async () => {
		expect(none("a", nil(), "b")).toBe("!(a|b)");
		expect(none("a", nil())).toBe("!a");
	});

	it("should drop empty expressions in groupBy", async () => {
		expect(groupBy("a", nil(), "b")).toBe("group by a b");
		expect(groupBy(nil())).toBe("");
	});

	it("should drop empty conditions in orderBy", async () => {
		expect(orderBy("a", nil(), "b")).toBe("order by a b");
		expect(orderBy(nil())).toBe("");
	});

	it("should drop empty conditions in having", async () => {
		expect(having(["a", nil(), "b"])).toBe("having ((a) && (b))");
		expect(having([nil()])).toBe("");
	});

	it("should drop empty clauses in where", async () => {
		expect(where("a", nil(), "b")).toBe("where { a b }");
		expect(where(nil())).toBe("");
	});

	it("should drop empty clauses in group", async () => {
		expect(group("a", nil(), "b")).toBe("{ a b }");
		expect(group(nil())).toBe("");
	});

	it("should drop empty clauses in optional", async () => {
		expect(optional("a", nil(), "b")).toBe("optional { a b }");
		expect(optional(nil())).toBe("");
	});

	it("should drop empty clauses in minus", async () => {
		expect(minus("a", nil(), "b")).toBe("minus { a b }");
		expect(minus(nil())).toBe("");
	});

	it("should drop empty clauses in graph", async () => {
		expect(graph("?g", "a", nil(), "b")).toBe("graph ?g { a b }");
		expect(graph("?g", nil())).toBe("");
	});

	it("should drop empty clauses in service", async () => {
		expect(service("?s", "a", nil(), "b")).toBe("service ?s { a b }");
		expect(service("?s", nil())).toBe("");
	});

	it("should drop empty clauses in exists", async () => {
		expect(exists("a", nil(), "b")).toBe("exists { a b }");
		expect(exists(nil())).toBe("");
	});

	it("should drop empty clauses in nexists", async () => {
		expect(nexists("a", nil(), "b")).toBe("not exists { a b }");
		expect(nexists(nil())).toBe("");
	});

	it("should drop empty conditions in and", async () => {
		expect(and("a", nil(), "b")).toBe("a && b");
	});

	it("should drop empty conditions in or", async () => {
		expect(or("a", nil(), "b")).toBe("a || b");
	});

	it("should drop empty expressions in coalesce", async () => {
		expect(coalesce("a", nil(), "b")).toBe("coalesce(a, b)");
	});

	it("should drop empty options in isIn", async () => {
		expect(isIn("?x", ["a", nil(), "b"])).toBe("?x in (a, b)");
	});

	it("should drop empty options in isNotIn", async () => {
		expect(isNotIn("?x", ["a", nil(), "b"])).toBe("?x not in (a, b)");
	});

	it("should drop empty arguments in call", async () => {
		expect(call("fn", "a", nil(), "b")).toBe("fn(a, b)");
	});

	it("should drop empty expressions in concat", async () => {
		expect(concat("a", nil(), "b")).toBe("concat(a, b)");
	});

	it("should drop empty variables and row terms in values", async () => {
		expect(values(["?x", nil(), "?y"], [["a", nil(), "b"]])).toBe("values (?x ?y) { (a b) }");
	});

});
