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

import {
	blank as blankTerm,
	named,
	rdf,
	tagged as taggedTerm,
	typed as typedTerm
} from "@metreeca/trio";
import { describe, expect, it } from "vitest";
import {
	abs,
	add,
	alt,
	anchor,
	and,
	ask,
	blank,
	bnode,
	boolean,
	call,
	ceil,
	coalesce,
	concat,
	contains,
	day,
	distinct,
	div,
	encodeForUri,
	exists,
	floor,
	fragment,
	from,
	fromNamed,
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
	pattern,
	patterns,
	rand,
	reduced,
	reference,
	regex,
	replace,
	round,
	seconds,
	seq,
	service,
	sha1,
	sha256,
	sha384,
	sha512,
	strafter,
	strbefore,
	strdt,
	strends,
	string,
	strlang,
	strlen,
	strstarts,
	struuid,
	sub,
	substr,
	tagged,
	term,
	timezone,
	triple,
	triples,
	typed,
	tz,
	ucase,
	union,
	update,
	using,
	usingNamed,
	uuid,
	values,
	variable,
	where,
	witt,
	year
} from "./builder.js";


describe("generators", () => {

	describe("updates", () => {

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

		describe("witt", () => {

			it("should prefix the clauses with a with block serialising the graph", async () => {
				expect(witt("urn:g", "a", "b")).toBe("with <urn:g> a b");
			});

			it("should drop empty clauses", async () => {
				expect(witt("urn:g", "a", nil(), "b")).toBe("with <urn:g> a b");
			});

			it("should yield the empty fragment for no surviving clauses", async () => {
				expect(witt("urn:g")).toBe("");
				expect(witt("urn:g", nil())).toBe("");
			});

		});

		describe("using", () => {

			it("should render a using clause serialising a single graph", async () => {
				expect(using("urn:g")).toBe("using <urn:g>");
			});

			it("should render one using clause per graph for a multi-graph default dataset", async () => {
				expect(using("urn:g1", "urn:g2")).toBe("using <urn:g1> using <urn:g2>");
			});

			it("should drop empty graphs", async () => {
				expect(using("urn:g1", nil(), "urn:g2")).toBe("using <urn:g1> using <urn:g2>");
			});

			it("should yield the empty fragment for no surviving graphs", async () => {
				expect(using()).toBe("");
				expect(using(nil())).toBe("");
			});

		});

		describe("usingNamed", () => {

			it("should render a using named clause serialising a single graph", async () => {
				expect(usingNamed("urn:g")).toBe("using named <urn:g>");
			});

			it("should render one using named clause per graph", async () => {
				expect(usingNamed("urn:g1", "urn:g2")).toBe("using named <urn:g1> using named <urn:g2>");
			});

			it("should drop empty graphs", async () => {
				expect(usingNamed("urn:g1", nil(), "urn:g2")).toBe("using named <urn:g1> using named <urn:g2>");
			});

			it("should yield the empty fragment for no surviving graphs", async () => {
				expect(usingNamed()).toBe("");
				expect(usingNamed(nil())).toBe("");
			});

		});

	});

	describe("queries", () => {

		describe("ask", () => {

			it("should accept a single array argument", async () => {
				expect(ask(["a", "b"])).toBe("ask a b");
			});

		});

		describe("distinct", () => {

			it("should count flattened elements from an array argument", async () => {
				expect(distinct(["a", "b"])).toBe("distinct a b");
			});

			it("should drop empty expressions", async () => {
				expect(distinct("a", nil(), "b")).toBe("distinct a b");
				expect(distinct(nil())).toBe("distinct");
			});

			it("should yield the bare keyword for no expressions", async () => {
				expect(distinct([])).toBe("distinct");
			});

		});

		describe("reduced", () => {

			it("should count flattened elements from an array argument", async () => {
				expect(reduced(["a", "b"])).toBe("reduced a b");
			});

			it("should drop empty expressions", async () => {
				expect(reduced("a", nil(), "b")).toBe("reduced a b");
				expect(reduced(nil())).toBe("reduced");
			});

			it("should yield the bare keyword for no expressions", async () => {
				expect(reduced([])).toBe("reduced");
			});

		});

		describe("from", () => {

			it("should render a from clause serialising a single graph", async () => {
				expect(from("urn:g")).toBe("from <urn:g>");
			});

			it("should render one from clause per graph for a multi-graph default dataset", async () => {
				expect(from("urn:g1", "urn:g2")).toBe("from <urn:g1> from <urn:g2>");
			});

			it("should accept a single array argument", async () => {
				expect(from(["urn:g1", "urn:g2"])).toBe("from <urn:g1> from <urn:g2>");
			});

			it("should drop empty graphs", async () => {
				expect(from("urn:g1", nil(), "urn:g2")).toBe("from <urn:g1> from <urn:g2>");
			});

			it("should yield the empty fragment for no surviving graphs", async () => {
				expect(from()).toBe("");
				expect(from(nil())).toBe("");
			});

		});

		describe("fromNamed", () => {

			it("should render a from named clause serialising a single graph", async () => {
				expect(fromNamed("urn:g")).toBe("from named <urn:g>");
			});

			it("should render one from named clause per graph", async () => {
				expect(fromNamed("urn:g1", "urn:g2")).toBe("from named <urn:g1> from named <urn:g2>");
			});

			it("should drop empty graphs", async () => {
				expect(fromNamed("urn:g1", nil(), "urn:g2")).toBe("from named <urn:g1> from named <urn:g2>");
			});

			it("should yield the empty fragment for no surviving graphs", async () => {
				expect(fromNamed()).toBe("");
				expect(fromNamed(nil())).toBe("");
			});

		});

		describe("groupBy", () => {

			it("should drop empty expressions", async () => {
				expect(groupBy("a", nil(), "b")).toBe("group by a b");
			});

			it("should yield the empty fragment for no surviving expressions", async () => {
				expect(groupBy(nil())).toBe("");
			});

		});

		describe("having", () => {

			it("should wrap a single condition in a having clause", async () => {
				expect(having("?count > 10")).toBe("having (?count > 10)");
			});

			it("should bracket and conjoin several conditions with &&", async () => {
				expect(having("?count > 10", "?sum < 100")).toBe("having ((?count > 10) && (?sum < 100))");
			});

			it("should drop empty conditions", async () => {
				expect(having("a", nil(), "b")).toBe("having ((a) && (b))");
			});

			it("should yield the empty fragment for no surviving conditions", async () => {
				expect(having()).toBe("");
				expect(having(nil())).toBe("");
			});

		});

		describe("orderBy", () => {

			it("should drop empty conditions", async () => {
				expect(orderBy("a", nil(), "b")).toBe("order by a b");
			});

			it("should yield the empty fragment for no surviving conditions", async () => {
				expect(orderBy(nil())).toBe("");
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

	});

	describe("query clauses", () => {

		describe("where", () => {

			it("should accept a single array argument", async () => {
				expect(where(["a", "b"])).toBe("where { a b }");
			});

			it("should drop empty clauses", async () => {
				expect(where("a", nil(), "b")).toBe("where { a b }");
			});

			it("should yield the empty fragment for no surviving clauses", async () => {
				expect(where(nil())).toBe("");
				expect(where([])).toBe("");
			});

		});

	});

	describe("graph patterns", () => {

		describe("union", () => {

			it("should drop empty clauses and unwrap a single survivor", async () => {
				expect(union("a", nil(), "b")).toBe("{ a } union { b }");
				expect(union("a", nil())).toBe("a");
			});

		});

		describe("optional", () => {

			it("should drop empty clauses", async () => {
				expect(optional("a", nil(), "b")).toBe("optional { a b }");
				expect(optional(nil())).toBe("");
			});

		});

		describe("group", () => {

			it("should drop empty clauses", async () => {
				expect(group("a", nil(), "b")).toBe("{ a b }");
				expect(group(nil())).toBe("");
			});

		});

		describe("minus", () => {

			it("should drop empty clauses", async () => {
				expect(minus("a", nil(), "b")).toBe("minus { a b }");
				expect(minus(nil())).toBe("");
			});

		});

		describe("graph", () => {

			it("should drop empty clauses", async () => {
				expect(graph("?g", "a", nil(), "b")).toBe("graph ?g { a b }");
				expect(graph("?g", nil())).toBe("");
			});

		});

		describe("service", () => {

			it("should drop empty clauses", async () => {
				expect(service("?s", "a", nil(), "b")).toBe("service ?s { a b }");
				expect(service("?s", nil())).toBe("");
			});

		});

		describe("values", () => {

			it("should drop empty variables and row terms", async () => {
				expect(values(["?x", nil(), "?y"], [["a", nil(), "b"]])).toBe("values (?x ?y) { (a b) }");
			});

		});

		describe("fragment", () => {

			it("should space-join the clauses", async () => {
				expect(fragment("a", "b", "c")).toBe("a b c");
			});

			it("should accept mixed spread and array arguments", async () => {
				expect(fragment("a", ["b", "c"], "d")).toBe("a b c d");
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

	});

	describe("property paths", () => {

		describe("seq", () => {

			it("should drop empty elements", async () => {
				expect(seq("a", nil(), "b")).toBe("a/b");
			});

		});

		describe("alt", () => {

			it("should drop empty elements", async () => {
				expect(alt("a", nil(), "b")).toBe("a|b");
			});

		});

		describe("none", () => {

			it("should drop empty predicates", async () => {
				expect(none("a", nil(), "b")).toBe("!(a|b)");
				expect(none("a", nil())).toBe("!a");
			});

		});

	});

	describe("logical operators", () => {

		describe("and", () => {

			it("should flatten an array argument", async () => {
				expect(and(["a", "b", "c"])).toBe("a && b && c");
			});

			it("should drop empty conditions", async () => {
				expect(and("a", nil(), "b")).toBe("a && b");
			});

		});

		describe("or", () => {

			it("should drop empty conditions", async () => {
				expect(or("a", nil(), "b")).toBe("a || b");
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

	describe("functional forms", () => {

		describe("coalesce", () => {

			it("should drop empty expressions", async () => {
				expect(coalesce("a", nil(), "b")).toBe("coalesce(a, b)");
			});

		});

		describe("isIn", () => {

			it("should drop empty options", async () => {
				expect(isIn("?x", ["a", nil(), "b"])).toBe("?x in (a, b)");
			});

		});

		describe("isNotIn", () => {

			it("should render a not-in membership test over the joined options", async () => {
				expect(isNotIn("?x", ["?a", "?b"])).toBe("?x not in (?a, ?b)");
			});

			it("should drop empty options", async () => {
				expect(isNotIn("?x", ["a", nil(), "b"])).toBe("?x not in (a, b)");
			});

			it("should render an empty not-in test for no options", async () => {
				expect(isNotIn("?x", [])).toBe("?x not in ()");
			});

		});

		describe("exists", () => {

			it("should drop empty clauses", async () => {
				expect(exists("a", nil(), "b")).toBe("exists { a b }");
				expect(exists(nil())).toBe("");
			});

		});

		describe("nexists", () => {

			it("should drop empty clauses", async () => {
				expect(nexists("a", nil(), "b")).toBe("not exists { a b }");
				expect(nexists(nil())).toBe("");
			});

		});

		describe("call", () => {

			it("should drop empty arguments", async () => {
				expect(call("fn", "a", nil(), "b")).toBe("fn(a, b)");
			});

		});

	});

	describe("term functions", () => {

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

			it("should drop empty expressions", async () => {
				expect(concat("a", nil(), "b")).toBe("concat(a, b)");
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

});

describe("serialisers", () => {

	describe("patterns", () => {

		it("should space-join the serialised patterns", async () => {
			expect(patterns([
				["?s", named("http://example.org/p"), "?o"],
				["?s", named(rdf.type), "?t"]
			])).toBe("?s <http://example.org/p> ?o . ?s a ?t .");
		});

		it("should render an empty sequence as the empty string", async () => {
			expect(patterns([])).toBe("");
		});

	});

	describe("pattern", () => {

		it("should render variable positions verbatim", async () => {
			expect(pattern(["?s", "?p", "?o"])).toBe("?s ?p ?o .");
		});

		it("should serialise ground positions", async () => {
			expect(pattern([named("http://example.org/s"), named("http://example.org/p"), typedTerm("v")]))
				.toBe("<http://example.org/s> <http://example.org/p> \"v\" .");
		});

		it("should abbreviate the rdf:type predicate as the a shorthand", async () => {
			expect(pattern(["?s", named(rdf.type), "?o"])).toBe("?s a ?o .");
		});

	});

	describe("triples", () => {

		it("should space-join the serialised triples", async () => {
			expect(triples([
				[named("http://example.org/s"), named("http://example.org/p"), typedTerm("v")],
				[named("http://example.org/s"), named(rdf.type), named("http://example.org/t")]
			])).toBe("<http://example.org/s> <http://example.org/p> \"v\" ."
				+" <http://example.org/s> a <http://example.org/t> .");
		});

		it("should render an empty sequence as the empty string", async () => {
			expect(triples([])).toBe("");
		});

	});

	describe("triple", () => {

		it("should serialise a ground statement", async () => {
			expect(triple([blankTerm("b0"), named("http://example.org/p"), named("http://example.org/o")]))
				.toBe("_:b0 <http://example.org/p> <http://example.org/o> .");
		});

		it("should abbreviate the rdf:type predicate as the a shorthand", async () => {
			expect(triple([named("http://example.org/s"), named(rdf.type), named("http://example.org/t")]))
				.toBe("<http://example.org/s> a <http://example.org/t> .");
		});

	});

	describe("anchor", () => {

		it("should render a variable verbatim", async () => {
			expect(anchor("?0")).toBe("?0");
		});

		it("should serialise a term", async () => {
			expect(anchor(named("http://example.org/x"))).toBe("<http://example.org/x>");
		});

	});

	describe("variable", () => {

		it("should render the variable token verbatim", async () => {
			expect(variable("?0")).toBe("?0");
		});

	});

	describe("term", () => {

		it("should serialise a blank node", async () => {
			expect(term(blankTerm("b0"))).toBe("_:b0");
		});

		it("should serialise an IRI reference", async () => {
			expect(term(named("http://example.org/x"))).toBe("<http://example.org/x>");
		});

		it("should serialise a language-tagged literal", async () => {
			expect(term(taggedTerm("hello", "en"))).toBe("\"hello\"@en");
		});

		it("should serialise a datatype-typed literal", async () => {
			expect(term(typedTerm("42", "http://www.w3.org/2001/XMLSchema#integer")))
				.toBe("\"42\"^^<http://www.w3.org/2001/XMLSchema#integer>");
		});

		it("should serialise a simple literal when datatype is absent", async () => {
			expect(term(typedTerm("hello"))).toBe("\"hello\"");
		});

	});

	describe("blank", () => {

		it("should render a string label into a prefixed token", async () => {
			expect(blank("b0")).toBe("_:b0");
		});

		it("should render a numeric label into a prefixed token", async () => {
			expect(blank(0)).toBe("_:0");
		});

		it("should mint a fresh label when no argument is provided", async () => {
			expect(blank()).toMatch(/^_:[0-9a-f]{32}$/);
		});

		it("should mint a distinct label on each call", async () => {
			expect(blank()).not.toBe(blank());
		});

	});

	describe("reference", () => {

		it("should wrap IRI in angle brackets", async () => {
			expect(reference("http://example.org/x")).toBe("<http://example.org/x>");
		});

		it("should escape supplementary code points in IRI", async () => {
			expect(reference("http://example.org/\u{1F600}")).toBe("<http://example.org/\\U0001F600>");
		});

		it.each([

			{ label: "null", code: 0x00 },
			{ label: "tab", code: 0x09 },
			{ label: "line feed", code: 0x0A },
			{ label: "space", code: 0x20 },
			{ label: "double quote", code: 0x22 },
			{ label: "less than", code: 0x3C },
			{ label: "greater than", code: 0x3E },
			{ label: "caret", code: 0x5E },
			{ label: "backslash", code: 0x5C },
			{ label: "backtick", code: 0x60 },
			{ label: "open brace", code: 0x7B },
			{ label: "pipe", code: 0x7C },
			{ label: "close brace", code: 0x7D }

		])("should reject $label, forbidden by the IRIREF production", async ({ code }) => {
			expect(() => reference(`http://example.org/${String.fromCodePoint(code)}`)).toThrow(RangeError);
		});

		it("should reject an isolated surrogate", async () => {
			expect(() => reference("http://example.org/\uD83D")).toThrow(RangeError);
			expect(() => reference("http://example.org/\uDE00")).toThrow(RangeError);
		});

		it("should leave non-ASCII BMP characters unchanged", async () => {
			expect(reference("http://example.org/é世")).toBe("<http://example.org/é世>");
		});

		it("should render a relative IRI verbatim", async () => {
			expect(reference("/relative")).toBe("</relative>");
		});

		it("should mint fresh urn:uuid reference when no argument is provided", async () => {
			expect(reference()).toMatch(/^<urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>$/);
		});

		it("should mint a distinct reference on each call", async () => {
			expect(reference()).not.toBe(reference());
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

		it("should reject an ill-formed lexical form", async () => {
			expect(() => string("smile \uD83D")).toThrow(RangeError);
		});

	});

	describe("tagged", () => {

		it("should serialise language-tagged literal", async () => {
			expect(tagged("hello", "en")).toBe("\"hello\"@en");
		});

		it("should escape text in language-tagged literal", async () => {
			expect(tagged("say \"hello\"", "en")).toBe("\"say \\\"hello\\\"\"@en");
		});

		it("should reject an ill-formed lexical form", async () => {
			expect(() => tagged("smile \uD83D", "en")).toThrow(RangeError);
		});

		it("should reject a malformed language tag", async () => {
			expect(() => tagged("hello", "en \"@en . <a> <b> <c>")).toThrow(RangeError);
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

		it("should reject an ill-formed lexical form", async () => {
			expect(() => typed("smile \uD83D")).toThrow(RangeError);
		});

		it("should reject a malformed datatype IRI", async () => {
			expect(() => typed("42", "http://example.org/a b")).toThrow(RangeError);
		});

	});

});
