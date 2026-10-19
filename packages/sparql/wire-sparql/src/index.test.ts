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

import { named, rdf, type Triple, triple, typed } from "@metreeca/trio";
import { describe, expect, test, vi } from "vitest";
import type { Dataset, Repository, RepositoryClient, Tuple } from "./index.js";
import {
	createBufferingRepository,
	createLoggingRepository,
	pattern,
	sparql,
	tuple,
	variable
} from "./index.js";


describe("factories", () => {

	describe("sparql", () => {

		test("removes the margin shared by the tagged literal", async () => {
			expect(sparql`
				select * {
					?s ?p ?o
				}
			`).toBe("select * {\n\t?s ?p ?o\n}");
		});

		test("splices interpolated values before removing the margin", async () => {
			expect(sparql`
				select * {
					${variable("s")} ?p ?o
				}
			`).toBe("select * {\n\t?s ?p ?o\n}");
		});

		test("removes the margin shared by a plain string", async () => {
			expect(sparql(`
				select * {
					?s ?p ?o
				}
			`)).toBe("select * {\n\t?s ?p ?o\n}");
		});

	});

	describe("tuple", () => {

		test("builds a frozen variable-to-term mapping", async () => {
			const solution = tuple({
				"?s": named("http://example.com/"),
				"?n": typed("42", "http://www.w3.org/2001/XMLSchema#integer")
			});
			expect(solution).toEqual({
				"?s": { kind: "named", iri: "http://example.com/" },
				"?n": { kind: "typed", text: "42", datatype: "http://www.w3.org/2001/XMLSchema#integer" }
			});
			expect(Object.isFrozen(solution)).toBe(true);
		});

	});

	describe("pattern", () => {

		test("builds a frozen pattern tuple admitting variables", async () => {
			const triplePattern = pattern(variable("s"), named(rdf.type), variable("o"));
			expect(triplePattern).toEqual(["?s", named(rdf.type), "?o"]);
			expect(Object.isFrozen(triplePattern)).toBe(true);
		});

	});

	describe("variable", () => {

		test("builds a token from a numeric index", async () => {
			expect(variable(0)).toBe("?0");
			expect(variable(42)).toBe("?42");
		});

		test("builds a token from a string name", async () => {
			expect(variable("name")).toBe("?name");
			expect(variable("v0")).toBe("?v0");
		});

		test("builds a token from a non-ASCII string name", async () => {
			expect(variable("é")).toBe("?é");
			expect(variable("日本1")).toBe("?日本1");
			expect(variable("\u{10400}x")).toBe("?\u{10400}x");
		});

		test("builds a token from a name carrying non-initial marks", async () => {
			expect(variable("a·b")).toBe("?a·b");
			expect(variable("á")).toBe("?á"); // combining acute accent
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
			expect(() => variable("a-b")).toThrow(RangeError); // PN_CHARS, but excluded from VARNAME
			expect(() => variable("a.b")).toThrow(RangeError);
			expect(() => variable("́a")).toThrow(RangeError); // combining mark: legal only after the first character
		});

	});

});

describe("wrappers", () => {

	const dataset: Dataset = { default: ["http://example.com/g"], named: ["http://example.com/n"] };


	describe("createBufferingRepository", () => {

		const rows = [tuple({ "?x": named("http://example.com/") })];
		const statements = [triple(named("http://example.com/s"), named(rdf.type), named("http://example.com/o"))];

		// a recording repository whose execute hands the task a separate, observable transaction scope

		function fakeRepository() {

			const scope = {
				ask: vi.fn(async (): Promise<boolean> => true),
				select: vi.fn(async (): Promise<readonly Tuple[]> => []),
				construct: vi.fn(async (): Promise<readonly Triple[]> => []),
				update: vi.fn<RepositoryClient["update"]>(async () => {}),
				merge: vi.fn<RepositoryClient["merge"]>(async () => {}),
				store: vi.fn<RepositoryClient["store"]>(async () => {})
			};

			const repository: Repository = {
				ask: vi.fn(async (): Promise<boolean> => true),
				select: vi.fn(async (): Promise<readonly Tuple[]> => rows),
				construct: vi.fn(async (): Promise<readonly Triple[]> => statements),
				update: vi.fn(async (): Promise<void> => {}),
				merge: vi.fn(async (): Promise<void> => {}),
				store: vi.fn(async (): Promise<void> => {}),
				execute: task => Promise.resolve(task(scope)),
				close: vi.fn(async (): Promise<void> => {})
			};

			return { repository, scope };
		}


		describe("outside a transaction", () => {

			test("delegates ask to the underlying repository", async () => {
				const { repository } = fakeRepository();
				await expect(createBufferingRepository(repository).ask("ASK")).resolves.toBe(true);
				expect(repository.ask).toHaveBeenCalledWith("ASK", undefined);
			});

			test("delegates select to the underlying repository", async () => {
				const { repository } = fakeRepository();
				await expect(createBufferingRepository(repository).select("SELECT")).resolves.toEqual(rows);
				expect(repository.select).toHaveBeenCalledWith("SELECT", undefined);
			});

			test("delegates construct to the underlying repository", async () => {
				const { repository } = fakeRepository();
				await expect(createBufferingRepository(repository).construct("CONSTRUCT")).resolves.toEqual(statements);
				expect(repository.construct).toHaveBeenCalledWith("CONSTRUCT", undefined);
			});

			test("delegates update directly to the underlying repository", async () => {
				const { repository } = fakeRepository();
				await createBufferingRepository(repository).update("INSERT");
				expect(repository.update).toHaveBeenCalledWith("INSERT", undefined);
			});

			test("delegates close to the underlying repository", async () => {
				const { repository } = fakeRepository();
				await createBufferingRepository(repository).close();
				expect(repository.close).toHaveBeenCalledTimes(1);
			});

			test("delegates datasets to the underlying repository", async () => {
				const { repository } = fakeRepository();
				const buffering = createBufferingRepository(repository);
				await buffering.ask("ASK", dataset);
				await buffering.select("SELECT", dataset);
				await buffering.construct("CONSTRUCT", dataset);
				await buffering.update("INSERT", dataset);
				expect(repository.ask).toHaveBeenCalledWith("ASK", dataset);
				expect(repository.select).toHaveBeenCalledWith("SELECT", dataset);
				expect(repository.construct).toHaveBeenCalledWith("CONSTRUCT", dataset);
				expect(repository.update).toHaveBeenCalledWith("INSERT", dataset);
			});

			test("delegates graph store writes directly to the underlying repository", async () => {
				const { repository } = fakeRepository();
				const buffering = createBufferingRepository(repository);
				await buffering.merge(statements, "http://example.com/g");
				await buffering.store(statements);
				expect(repository.merge).toHaveBeenCalledWith(statements, "http://example.com/g");
				expect(repository.store).toHaveBeenCalledWith(statements, undefined);
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
				expect(scope.update).toHaveBeenCalledWith("U1; U2", undefined);
			});

			test("flushes consecutive updates sharing a dataset as a single update", async () => {
				const { repository, scope } = fakeRepository();
				await createBufferingRepository(repository).execute(async client => {
					await client.update("U1", dataset);
					await client.update("U2", { default: ["http://example.com/g"], named: ["http://example.com/n"] });
				});
				expect(scope.update).toHaveBeenCalledTimes(1);
				expect(scope.update).toHaveBeenCalledWith("U1; U2", dataset);
			});

			test("splits the flush where the dataset changes, preserving order", async () => {
				const { repository, scope } = fakeRepository();
				await createBufferingRepository(repository).execute(async client => {
					await client.update("U1");
					await client.update("U2", dataset);
					await client.update("U3", dataset);
					await client.update("U4");
				});
				expect(scope.update.mock.calls).toEqual([
					["U1", undefined],
					["U2; U3", dataset],
					["U4", undefined]
				]);
			});

			test("buffers graph store writes until commit", async () => {
				const { repository, scope } = fakeRepository();
				await createBufferingRepository(repository).execute(async client => {
					await client.merge(statements, "http://example.com/g");
					await client.store(statements);
					expect(scope.merge).not.toHaveBeenCalled();
					expect(scope.store).not.toHaveBeenCalled();
				});
				expect(scope.merge).toHaveBeenCalledWith(statements, "http://example.com/g");
				expect(scope.store).toHaveBeenCalledWith(statements, undefined);
			});

			test("flushes graph store writes in issue order, splitting update runs", async () => {
				const { repository, scope } = fakeRepository();
				const flushed: string[] = [];
				scope.update.mockImplementation(async update => void flushed.push(update));
				scope.merge.mockImplementation(async () => void flushed.push("MERGE"));
				scope.store.mockImplementation(async () => void flushed.push("STORE"));
				await createBufferingRepository(repository).execute(async client => {
					await client.update("U1");
					await client.update("U2");
					await client.merge(statements);
					await client.update("U3");
					await client.store(statements);
					await client.update("U4");
				});
				expect(flushed).toEqual(["U1; U2", "MERGE", "U3", "STORE", "U4"]);
			});

			test("discards buffered graph store writes when the task rejects", async () => {
				const { repository, scope } = fakeRepository();
				await expect(createBufferingRepository(repository).execute(async client => {
					await client.merge(statements);
					await client.store(statements);
					throw new Error("boom");
				})).rejects.toThrow();
				expect(scope.merge).not.toHaveBeenCalled();
				expect(scope.store).not.toHaveBeenCalled();
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
				expect(scope.ask).toHaveBeenCalledWith("ASK", undefined);
				expect(scope.select).toHaveBeenCalledWith("SELECT", undefined);
				expect(scope.construct).toHaveBeenCalledWith("CONSTRUCT", undefined);
			});

			test("forwards query datasets to the transaction scope", async () => {
				const { repository, scope } = fakeRepository();
				await createBufferingRepository(repository).execute(async client => {
					await client.ask("ASK", dataset);
					await client.select("SELECT", dataset);
					await client.construct("CONSTRUCT", dataset);
				});
				expect(scope.ask).toHaveBeenCalledWith("ASK", dataset);
				expect(scope.select).toHaveBeenCalledWith("SELECT", dataset);
				expect(scope.construct).toHaveBeenCalledWith("CONSTRUCT", dataset);
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

		const rows = [tuple({ "?x": named("http://example.com/") })];
		const statements = [triple(named("http://example.com/s"), named(rdf.type), named("http://example.com/o"))];

		// a recording repository whose execute hands the task a separate, observable transaction scope

		function fakeRepository() {

			const scope = {
				ask: vi.fn(async (): Promise<boolean> => true),
				select: vi.fn(async (): Promise<readonly Tuple[]> => rows),
				construct: vi.fn(async (): Promise<readonly Triple[]> => statements),
				update: vi.fn(async (): Promise<void> => {}),
				merge: vi.fn(async (): Promise<void> => {}),
				store: vi.fn(async (): Promise<void> => {})
			};

			const repository: Repository = {
				ask: vi.fn(async (): Promise<boolean> => true),
				select: vi.fn(async (): Promise<readonly Tuple[]> => rows),
				construct: vi.fn(async (): Promise<readonly Triple[]> => statements),
				update: vi.fn(async (): Promise<void> => {}),
				merge: vi.fn(async (): Promise<void> => {}),
				store: vi.fn(async (): Promise<void> => {}),
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

			test("logs each graph store write with its elapsed time, triple count and target graph", async () => {
				const { repository } = fakeRepository();
				const logger = vi.fn<(message: string) => void>();
				const logging = createLoggingRepository(repository, logger);
				await logging.merge(statements, "http://example.com/g");
				await logging.store(statements);
				expect(logged(logger)).toContainEqual(expect.stringMatching(
					/^merged <1> triples into <http:\/\/example\.com\/g> in <\d+> ms$/
				));
				expect(logged(logger)).toContainEqual(expect.stringMatching(
					/^stored <1> triples into default graph in <\d+> ms$/
				));
			});

			test("delegates graph store writes to the underlying repository", async () => {
				const { repository } = fakeRepository();
				const logging = createLoggingRepository(repository, vi.fn());
				await logging.merge(statements, "http://example.com/g");
				await logging.store(statements);
				expect(repository.merge).toHaveBeenCalledWith(statements, "http://example.com/g");
				expect(repository.store).toHaveBeenCalledWith(statements, undefined);
			});

			test("delegates the query result unchanged", async () => {
				const { repository } = fakeRepository();
				await expect(createLoggingRepository(repository, vi.fn()).select("SELECT")).resolves.toEqual(rows);
			});

			test("delegates datasets to the underlying repository", async () => {
				const { repository } = fakeRepository();
				const logging = createLoggingRepository(repository, vi.fn());
				await logging.ask("ASK", dataset);
				await logging.select("SELECT", dataset);
				await logging.construct("CONSTRUCT", dataset);
				await logging.update("INSERT", dataset);
				expect(repository.ask).toHaveBeenCalledWith("ASK", dataset);
				expect(repository.select).toHaveBeenCalledWith("SELECT", dataset);
				expect(repository.construct).toHaveBeenCalledWith("CONSTRUCT", dataset);
				expect(repository.update).toHaveBeenCalledWith("INSERT", dataset);
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

			test("logs graph store writes issued through the transaction client", async () => {
				const { repository, scope } = fakeRepository();
				const logger = vi.fn<(message: string) => void>();
				await createLoggingRepository(repository, logger).execute(async client => {
					await client.merge(statements, "http://example.com/g");
					await client.store(statements, "http://example.com/g");
				});
				expect(logged(logger).some(message => message.startsWith("merged <1> triples into"))).toBe(true);
				expect(logged(logger).some(message => message.startsWith("stored <1> triples into"))).toBe(true);
				expect(scope.merge).toHaveBeenCalledWith(statements, "http://example.com/g");
				expect(scope.store).toHaveBeenCalledWith(statements, "http://example.com/g");
			});

			test("forwards transaction operations to the underlying scope", async () => {
				const { repository, scope } = fakeRepository();
				await createLoggingRepository(repository, vi.fn()).execute(async client => {
					await client.ask("ASK");
					await client.update("INSERT");
				});
				expect(scope.ask).toHaveBeenCalledWith("ASK", undefined);
				expect(scope.update).toHaveBeenCalledWith("INSERT", undefined);
			});

			test("forwards transaction datasets to the underlying scope", async () => {
				const { repository, scope } = fakeRepository();
				await createLoggingRepository(repository, vi.fn()).execute(async client => {
					await client.select("SELECT", dataset);
					await client.update("INSERT", dataset);
				});
				expect(scope.select).toHaveBeenCalledWith("SELECT", dataset);
				expect(scope.update).toHaveBeenCalledWith("INSERT", dataset);
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
