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

import { describe, expect, test, vi } from "vitest";
import type { Repository, Triple, Tuple } from "./index.js";
import {
	blank,
	createBufferingRepository,
	createLoggingRepository,
	graph,
	isBlank,
	isGraph,
	isObject,
	isPattern,
	isPredicate,
	isReference,
	isSubject,
	isTagged,
	isTerm,
	isTriple,
	isTuple,
	isTyped,
	isVariable,
	pattern,
	reference,
	skolemize,
	tagged,
	triple,
	tuple,
	typed,
	variable
} from "./index.js";


describe("type guards", () => {

	describe("isTuple", () => {

		test("accepts a record keyed by variable tokens mapping to terms", async () => {
			expect(isTuple({ "?0": "http://example.com/", "?1": typed("v") })).toBe(true);
			expect(isTuple({})).toBe(true);
		});

		test("rejects a record with a non-variable key or a non-term value", async () => {
			expect(isTuple({ "0": typed("v") })).toBe(false);
			expect(isTuple({ "?a b": typed("v") })).toBe(false);
			expect(isTuple({ "?0": "plain" })).toBe(false);
		});

	});

	describe("isTriple", () => {

		test("accepts a subject/predicate/object triple", async () => {
			expect(isTriple(["http://example.com/s", "a", "http://example.com/o"])).toBe(true);
			expect(isTriple(["_:0", "http://example.com/p", typed("v")])).toBe(true);
		});

		test("rejects a wrong-length tuple and a malformed predicate position", async () => {
			expect(isTriple(["http://example.com/s", "http://example.com/p"])).toBe(false);
			expect(isTriple(["http://example.com/s", "_:0", "http://example.com/o"])).toBe(false);
		});

	});

	describe("isGraph", () => {

		test("accepts an array of triples, including the empty graph", async () => {
			expect(isGraph([["http://example.com/s", "a", "http://example.com/o"]])).toBe(true);
			expect(isGraph([])).toBe(true);
		});

		test("rejects a non-array and an array holding a non-triple element", async () => {
			expect(isGraph(["http://example.com/s", "a", "http://example.com/o"])).toBe(false);
			expect(isGraph([["http://example.com/s", "_:0", "http://example.com/o"]])).toBe(false);
		});

	});

	describe("isPattern", () => {

		test("accepts variables and ground terms in each position", async () => {
			expect(isPattern(["?s", "?p", "?o"])).toBe(true);
			expect(isPattern(["http://example.com/s", "a", typed("v")])).toBe(true);
		});

		test("rejects a wrong-length tuple and a malformed predicate position", async () => {
			expect(isPattern(["?s", "?p"])).toBe(false);
			expect(isPattern(["?s", "_:0", "?o"])).toBe(false);
		});

	});


	describe("isSubject", () => {

		test("accepts a blank node and an IRI", async () => {
			expect(isSubject("_:0")).toBe(true);
			expect(isSubject("http://example.com/")).toBe(true);
		});

		test("rejects a variable and a literal", async () => {
			expect(isSubject("?0")).toBe(false);
			expect(isSubject(typed("v"))).toBe(false);
		});

	});

	describe("isPredicate", () => {

		test("accepts the a shorthand and an IRI", async () => {
			expect(isPredicate("a")).toBe(true);
			expect(isPredicate("http://example.com/p")).toBe(true);
		});

		test("rejects a blank node and a variable", async () => {
			expect(isPredicate("_:0")).toBe(false);
			expect(isPredicate("?0")).toBe(false);
		});

	});

	describe("isObject", () => {

		test("accepts any term", async () => {
			expect(isObject("http://example.com/")).toBe(true);
			expect(isObject(typed("v"))).toBe(true);
		});

		test("rejects a variable token", async () => {
			expect(isObject("?0")).toBe(false);
		});

	});


	describe("isVariable", () => {

		test("accepts a ?-prefixed token", async () => {
			expect(isVariable("?0")).toBe(true);
		});

		test("accepts a minted token", async () => {
			expect(isVariable(variable())).toBe(true);
		});

		test("rejects a blank label, an IRI, and a bare number", async () => {
			expect(isVariable("_:0")).toBe(false);
			expect(isVariable("http://example.com/")).toBe(false);
			expect(isVariable(0)).toBe(false);
		});

		test("rejects an empty or malformed name", async () => {
			expect(isVariable("?")).toBe(false);
			expect(isVariable("?a b")).toBe(false);
			expect(isVariable("?a-b")).toBe(false);
		});

	});

	describe("isBlank", () => {

		test("accepts a _:-prefixed label", async () => {
			expect(isBlank("_:0")).toBe(true);
		});

		test("accepts a minted label", async () => {
			expect(isBlank(blank())).toBe(true);
		});

		test("rejects a variable, an IRI, and a bare number", async () => {
			expect(isBlank("?0")).toBe(false);
			expect(isBlank("http://example.com/")).toBe(false);
			expect(isBlank(0)).toBe(false);
		});

		test("rejects an empty or malformed label", async () => {
			expect(isBlank("_:")).toBe(false);
			expect(isBlank("_:a b")).toBe(false);
			expect(isBlank("_:a.")).toBe(false);
		});

	});

	describe("isReference", () => {

		test("accepts an absolute IRI", async () => {
			expect(isReference("http://example.com/")).toBe(true);
		});

		test("rejects a relative IRI, a blank label, and a variable", async () => {
			expect(isReference("/relative")).toBe(false);
			expect(isReference("_:0")).toBe(false);
			expect(isReference("?0")).toBe(false);
		});

	});

	describe("isTagged", () => {

		test("accepts a text/language pair", async () => {
			expect(isTagged(tagged("hi", "en"))).toBe(true);
		});

		test("rejects a pair missing the language tag and a non-record", async () => {
			expect(isTagged({ text: "hi" })).toBe(false);
			expect(isTagged("hi")).toBe(false);
		});

	});

	describe("isTyped", () => {

		test("accepts a plain and a datatype-annotated literal", async () => {
			expect(isTyped(typed("v"))).toBe(true);
			expect(isTyped(typed("42", "http://www.w3.org/2001/XMLSchema#integer"))).toBe(true);
		});

		test("rejects a non-string text and a non-record", async () => {
			expect(isTyped({ text: 1 })).toBe(false);
			expect(isTyped("v")).toBe(false);
		});

		test("rejects a relative or malformed datatype IRI", async () => {
			expect(isTyped({ text: "v", datatype: "/relative" })).toBe(false);
			expect(isTyped({ text: "v", datatype: "not-an-iri" })).toBe(false);
		});

	});

	describe("isTerm", () => {

		test("accepts a blank node, an IRI, and both literal forms", async () => {
			expect(isTerm("_:0")).toBe(true);
			expect(isTerm("http://example.com/")).toBe(true);
			expect(isTerm(tagged("hi", "en"))).toBe(true);
			expect(isTerm(typed("v"))).toBe(true);
		});

		test("rejects a variable token and a bare number", async () => {
			expect(isTerm("?0")).toBe(false);
			expect(isTerm(0)).toBe(false);
		});

	});

});

describe("factories", () => {

	const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;


	describe("variable", () => {

		test("builds a token from a numeric index", async () => {
			expect(variable(0)).toBe("?0");
			expect(variable(42)).toBe("?42");
		});

		test("builds a token from a string name", async () => {
			expect(variable("name")).toBe("?name");
			expect(variable("v0")).toBe("?v0");
		});

		test("canonicalises a numeric string to the same token as the number", async () => {
			expect(variable("0")).toBe(variable(0));
		});

		test("mints a fresh token matching VariablePattern when no argument is provided", async () => {
			expect(variable()).toMatch(/^\?[0-9a-f]{32}$/);
		});

		test("mints a distinct token on each anonymous call", async () => {
			expect(variable()).not.toBe(variable());
		});

		test("rejects a negative or non-integer number", async () => {
			expect(() => variable(-1)).toThrow(RangeError);
			expect(() => variable(1.5)).toThrow(RangeError);
		});

		test("rejects an empty or malformed string name", async () => {
			expect(() => variable("")).toThrow(RangeError);
			expect(() => variable("a b")).toThrow(RangeError);
			expect(() => variable("a-b")).toThrow(RangeError);
		});

	});

	describe("blank", () => {

		test("builds a label from a numeric id", async () => {
			expect(blank(0)).toBe("_:0");
			expect(blank(7)).toBe("_:7");
		});

		test("builds a label from a string id", async () => {
			expect(blank("b0")).toBe("_:b0");
		});

		test("mints a fresh token matching BlankPattern when no argument is provided", async () => {
			expect(blank()).toMatch(/^_:[0-9a-f]{32}$/);
		});

		test("mints a distinct label on each anonymous call", async () => {
			expect(blank()).not.toBe(blank());
		});

		test("rejects a negative or non-integer number", async () => {
			expect(() => blank(-1)).toThrow(RangeError);
			expect(() => blank(1.5)).toThrow(RangeError);
		});

		test("rejects an empty or malformed string label", async () => {
			expect(() => blank("")).toThrow(RangeError);
			expect(() => blank("a b")).toThrow(RangeError);
			expect(() => blank("a.")).toThrow(RangeError);
		});

	});

	describe("reference", () => {

		test("returns an absolute IRI unchanged", async () => {
			expect(reference("http://example.com/")).toBe("http://example.com/");
		});

		test("mints a fresh urn:uuid IRI when no argument is provided", async () => {
			expect(reference()).toMatch(new RegExp(`^urn:uuid:${UUID.source}$`));
		});

		test("rejects a blank-node label", async () => {
			expect(() => reference("_:b1")).toThrow(RangeError);
		});

		test("rejects a relative or malformed IRI", async () => {
			expect(() => reference("/relative")).toThrow(RangeError);
		});

	});

	describe("tagged", () => {

		test("builds a frozen text/language record", async () => {
			const term = tagged("hi", "en");
			expect(term).toEqual({ text: "hi", language: "en" });
			expect(Object.isFrozen(term)).toBe(true);
		});

	});

	describe("typed", () => {

		test("builds a plain literal when the datatype is omitted", async () => {
			expect(typed("v")).toEqual({ text: "v" });
		});

		test("builds a datatype-annotated literal", async () => {
			expect(typed("42", "http://www.w3.org/2001/XMLSchema#integer"))
				.toEqual({ text: "42", datatype: "http://www.w3.org/2001/XMLSchema#integer" });
		});

		test("coerces a number scalar to its lexical form", async () => {
			expect(typed(42, "http://www.w3.org/2001/XMLSchema#integer"))
				.toEqual({ text: "42", datatype: "http://www.w3.org/2001/XMLSchema#integer" });
		});

		test("coerces a boolean scalar to its lexical form", async () => {
			expect(typed(true, "http://www.w3.org/2001/XMLSchema#boolean"))
				.toEqual({ text: "true", datatype: "http://www.w3.org/2001/XMLSchema#boolean" });
		});

		test("freezes the returned record", async () => {
			expect(Object.isFrozen(typed("v"))).toBe(true);
		});

	});

	describe("triple", () => {

		test("builds a frozen statement tuple", async () => {
			const statement = triple("_:0", "a", reference("http://example.com/"));
			expect(statement).toEqual(["_:0", "a", "http://example.com/"]);
			expect(Object.isFrozen(statement)).toBe(true);
		});

	});

	describe("graph", () => {

		test("collects triples into a frozen sequence", async () => {
			const triples = graph(
				triple("_:0", "a", reference("http://example.com/")),
				triple("_:0", reference("http://example.com/p"), typed("v"))
			);
			expect(triples).toHaveLength(2);
			expect(Object.isFrozen(triples)).toBe(true);
		});

		test("builds an empty graph from no arguments", async () => {
			expect(graph()).toEqual([]);
		});

	});

	describe("pattern", () => {

		test("builds a frozen pattern tuple admitting variables", async () => {
			const triplePattern = pattern(variable("s"), "a", variable("o"));
			expect(triplePattern).toEqual(["?s", "a", "?o"]);
			expect(Object.isFrozen(triplePattern)).toBe(true);
		});

	});

	describe("tuple", () => {

		test("builds a frozen variable-to-term mapping", async () => {
			const solution = tuple({
				"?s": reference("http://example.com/"),
				"?n": typed("42", "http://www.w3.org/2001/XMLSchema#integer")
			});
			expect(solution).toEqual({
				"?s": "http://example.com/",
				"?n": { text: "42", datatype: "http://www.w3.org/2001/XMLSchema#integer" }
			});
			expect(Object.isFrozen(solution)).toBe(true);
		});

	});

});

describe("utilities", () => {

	describe("skolemize", () => {

		test("leaves a ground triple unchanged", async () => {
			expect(skolemize([["http://example.com/s", "a", typed("v")]]))
				.toEqual([["http://example.com/s", "a", typed("v")]]);
		});

		test("replaces a blank-node subject with a minted IRI reference", async () => {
			const [[subject, predicate, object]] =
				skolemize([["_:0", "http://example.com/p", "http://example.com/o"]]);
			expect(isReference(subject)).toBe(true);
			expect(isBlank(subject)).toBe(false);
			expect(predicate).toBe("http://example.com/p");
			expect(object).toBe("http://example.com/o");
		});

		test("replaces a blank-node object with a minted IRI reference", async () => {
			const [[, , object]] = skolemize([["http://example.com/s", "http://example.com/p", "_:0"]]);
			expect(isReference(object)).toBe(true);
			expect(isBlank(object)).toBe(false);
		});

		test("correlates repeated blank labels within the sequence to one reference", async () => {
			const [[s0, , o0], [s1, , o1]] = skolemize([
				["_:0", "http://example.com/p", "_:1"],
				["_:1", "http://example.com/p", "_:0"]
			]);
			expect(s0).toBe(o1); // both decode the "_:0" label
			expect(o0).toBe(s1); // both decode the "_:1" label
			expect(s0).not.toBe(o0); // distinct labels mint distinct references
		});

		test("mints urn:uuid references", async () => {
			const [[subject]] = skolemize([["_:0", "http://example.com/p", "http://example.com/o"]]);
			expect(subject).toMatch(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
		});

		test("returns the empty sequence for an empty input", async () => {
			expect(skolemize([])).toEqual([]);
		});

	});

});

describe("wrappers", () => {

	describe("createBufferingRepository", () => {

		const rows = [tuple({ "?x": reference("http://example.com/") })];
		const statements = [triple("http://example.com/s", "a", reference("http://example.com/o"))];

		// a recording repository whose execute hands the task a separate, observable transaction scope

		function fakeRepository() {

			const scope = {
				ask: vi.fn(async (): Promise<boolean> => true),
				select: vi.fn(async (): Promise<readonly Tuple[]> => []),
				construct: vi.fn(async (): Promise<readonly Triple[]> => []),
				update: vi.fn(async (): Promise<void> => {})
			};

			const repository: Repository = {
				ask: vi.fn(async (): Promise<boolean> => true),
				select: vi.fn(async (): Promise<readonly Tuple[]> => rows),
				construct: vi.fn(async (): Promise<readonly Triple[]> => statements),
				update: vi.fn(async (): Promise<void> => {}),
				execute: task => Promise.resolve(task(scope)),
				close: vi.fn(async (): Promise<void> => {})
			};

			return { repository, scope };
		}


		describe("outside a transaction", () => {

			test("delegates ask to the underlying repository", async () => {
				const { repository } = fakeRepository();
				await expect(createBufferingRepository(repository).ask("ASK")).resolves.toBe(true);
				expect(repository.ask).toHaveBeenCalledWith("ASK");
			});

			test("delegates select to the underlying repository", async () => {
				const { repository } = fakeRepository();
				await expect(createBufferingRepository(repository).select("SELECT")).resolves.toEqual(rows);
				expect(repository.select).toHaveBeenCalledWith("SELECT");
			});

			test("delegates construct to the underlying repository", async () => {
				const { repository } = fakeRepository();
				await expect(createBufferingRepository(repository).construct("CONSTRUCT")).resolves.toEqual(statements);
				expect(repository.construct).toHaveBeenCalledWith("CONSTRUCT");
			});

			test("delegates update directly to the underlying repository", async () => {
				const { repository } = fakeRepository();
				await createBufferingRepository(repository).update("INSERT");
				expect(repository.update).toHaveBeenCalledWith("INSERT");
			});

			test("delegates close to the underlying repository", async () => {
				const { repository } = fakeRepository();
				await createBufferingRepository(repository).close();
				expect(repository.close).toHaveBeenCalledTimes(1);
			});

		});

		describe("within a transaction", () => {

			test("flushes buffered updates as a single combined update on commit", async () => {
				const { repository, scope } = fakeRepository();
				await createBufferingRepository(repository).execute(async client => {
					await client.update("U1");
					await client.update("U2");
				});
				expect(scope.update).toHaveBeenCalledTimes(1);
				expect(scope.update).toHaveBeenCalledWith("U1;\nU2");
			});

			test("issues no update when the task performs none", async () => {
				const { repository, scope } = fakeRepository();
				await createBufferingRepository(repository).execute(async () => {});
				expect(scope.update).not.toHaveBeenCalled();
			});

			test("forwards queries to the transaction scope unbuffered", async () => {
				const { repository, scope } = fakeRepository();
				await createBufferingRepository(repository).execute(async client => {
					await client.ask("ASK");
					await client.select("SELECT");
					await client.construct("CONSTRUCT");
				});
				expect(scope.ask).toHaveBeenCalledWith("ASK");
				expect(scope.select).toHaveBeenCalledWith("SELECT");
				expect(scope.construct).toHaveBeenCalledWith("CONSTRUCT");
			});

			test("resolves to the value returned by the task", async () => {
				const { repository } = fakeRepository();
				await expect(createBufferingRepository(repository).execute(async () => 42)).resolves.toBe(42);
			});

			test("discards buffered updates when the task rejects", async () => {
				const { repository, scope } = fakeRepository();
				await expect(createBufferingRepository(repository).execute(async client => {
					await client.update("U1");
					throw new Error("boom");
				})).rejects.toThrow();
				expect(scope.update).not.toHaveBeenCalled();
			});

		});

	});

	describe("createLoggingRepository", () => {

		const rows = [tuple({ "?x": reference("http://example.com/") })];
		const statements = [triple("http://example.com/s", "a", reference("http://example.com/o"))];

		// a recording repository whose execute hands the task a separate, observable transaction scope

		function fakeRepository() {

			const scope = {
				ask: vi.fn(async (): Promise<boolean> => true),
				select: vi.fn(async (): Promise<readonly Tuple[]> => rows),
				construct: vi.fn(async (): Promise<readonly Triple[]> => statements),
				update: vi.fn(async (): Promise<void> => {})
			};

			const repository: Repository = {
				ask: vi.fn(async (): Promise<boolean> => true),
				select: vi.fn(async (): Promise<readonly Tuple[]> => rows),
				construct: vi.fn(async (): Promise<readonly Triple[]> => statements),
				update: vi.fn(async (): Promise<void> => {}),
				execute: task => Promise.resolve(task(scope)),
				close: vi.fn(async (): Promise<void> => {})
			};

			return { repository, scope };
		}

		// the messages logged across a run

		function logged(logger: ReturnType<typeof vi.fn<(message: string) => void>>) {
			return logger.mock.calls.map(([message]) => message);
		}


		describe("outside a transaction", () => {

			test("logs each query with its elapsed time and request text", async () => {
				const { repository } = fakeRepository();
				const logger = vi.fn<(message: string) => void>();
				await createLoggingRepository(repository, logger).ask("ASK");
				expect(logged(logger).some(message => message.includes("executed query in") && message.includes("ASK"))).toBe(true);
			});

			test("logs each update with its elapsed time and request text", async () => {
				const { repository } = fakeRepository();
				const logger = vi.fn<(message: string) => void>();
				await createLoggingRepository(repository, logger).update("INSERT");
				expect(logged(logger).some(message => message.includes("executed update in") && message.includes("INSERT"))).toBe(true);
			});

			test("delegates the query result unchanged", async () => {
				const { repository } = fakeRepository();
				await expect(createLoggingRepository(repository, vi.fn()).select("SELECT")).resolves.toEqual(rows);
			});

			test("logs closing the repository", async () => {
				const { repository } = fakeRepository();
				const logger = vi.fn<(message: string) => void>();
				await createLoggingRepository(repository, logger).close();
				expect(logged(logger)).toContain("closing repository");
			});

		});

		describe("within a transaction", () => {

			test("logs the transaction opening and commit", async () => {
				const { repository } = fakeRepository();
				const logger = vi.fn<(message: string) => void>();
				await createLoggingRepository(repository, logger).execute(async () => {});
				expect(logged(logger)).toContain("opening transaction");
				expect(logged(logger).some(message => message.includes("committed transaction in"))).toBe(true);
			});

			test("logs queries issued through the transaction client", async () => {
				const { repository } = fakeRepository();
				const logger = vi.fn<(message: string) => void>();
				await createLoggingRepository(repository, logger).execute(async client => {
					await client.ask("ASK");
					await client.select("SELECT");
					await client.construct("CONSTRUCT");
				});
				expect(logged(logger).some(message => message.includes("executed query in") && message.includes("ASK"))).toBe(true);
				expect(logged(logger).some(message => message.includes("executed query in") && message.includes("SELECT"))).toBe(true);
				expect(logged(logger).some(message => message.includes("executed query in") && message.includes("CONSTRUCT"))).toBe(true);
			});

			test("logs updates issued through the transaction client", async () => {
				const { repository } = fakeRepository();
				const logger = vi.fn<(message: string) => void>();
				await createLoggingRepository(repository, logger).execute(async client => {
					await client.update("INSERT");
				});
				expect(logged(logger).some(message => message.includes("executed update in") && message.includes("INSERT"))).toBe(true);
			});

			test("forwards transaction operations to the underlying scope", async () => {
				const { repository, scope } = fakeRepository();
				await createLoggingRepository(repository, vi.fn()).execute(async client => {
					await client.ask("ASK");
					await client.update("INSERT");
				});
				expect(scope.ask).toHaveBeenCalledWith("ASK");
				expect(scope.update).toHaveBeenCalledWith("INSERT");
			});

			test("resolves to the value returned by the task", async () => {
				const { repository } = fakeRepository();
				await expect(createLoggingRepository(repository, vi.fn()).execute(async () => 42)).resolves.toBe(42);
			});

			test("logs the abort with the propagated error and rethrows", async () => {
				const { repository } = fakeRepository();
				const logger = vi.fn<(message: string) => void>();
				await expect(createLoggingRepository(repository, logger).execute(async () => {
					throw new Error("boom");
				})).rejects.toThrow("boom");
				expect(logged(logger).some(message => message.includes("aborted transaction") && message.includes("boom"))).toBe(true);
			});

		});

	});

});
