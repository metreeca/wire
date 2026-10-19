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

import { xsd } from "@metreeca/core/datatype";
import { blank, named, triple, typed } from "@metreeca/trio";
import type { Repository } from "@metreeca/wire-sparql";
import { describe, expect, it } from "vitest";
import { createOxiRepository } from "./index.js";


describe("createOxiRepository", () => {

	describe("datasets", () => {

		const s = "http://example.org/s";
		const p = "http://example.org/p";

		const g1 = "http://example.org/g1";
		const g2 = "http://example.org/g2";


		/**
		 * Creates a repository holding one statement in each of the graphs `g1` and `g2`.
		 */
		async function fixture() {

			const oxi = createOxiRepository();

			await oxi.update(`insert data {
				graph <${g1}> { <${s}> <${p}> "1" }
				graph <${g2}> { <${s}> <${p}> "2" }
			}`);

			return oxi;

		}


		it("queries the default graphs of the dataset", async () => {

			const oxi = await fixture();

			await expect(oxi.select("select ?o { ?s ?p ?o }", { default: [g1] }))
				.resolves.toEqual([{ "?o": typed("1") }]);

		});

		it("overrides the dataset declared by the query", async () => {

			const oxi = await fixture();

			await expect(oxi.select(`select ?o from <${g2}> { ?s ?p ?o }`, { default: [g1] }))
				.resolves.toEqual([{ "?o": typed("1") }]);

		});

		it("leaves the query dataset in effect when the dataset lists no graphs", async () => {

			const oxi = await fixture();

			await expect(oxi.select(`select ?o from <${g2}> { ?s ?p ?o }`, {}))
				.resolves.toEqual([{ "?o": typed("2") }]);

		});

		it("queries the named graphs of the dataset over an empty default graph", async () => {

			const oxi = await fixture();

			await expect(oxi.select("select ?g ?o { graph ?g { ?s ?p ?o } }", { named: [g2] }))
				.resolves.toEqual([{ "?g": named(g2), "?o": typed("2") }]);

			await expect(oxi.ask("ask { ?s ?p ?o }", { named: [g2] }))
				.resolves.toBe(false);

		});

		it("applies the dataset to ask and construct queries", async () => {

			const oxi = await fixture();

			await expect(oxi.ask(`ask { ?s ?p "2" }`, { default: [g2] })).resolves.toBe(true);
			await expect(oxi.ask(`ask { ?s ?p "2" }`, { default: [g1] })).resolves.toBe(false);

			await expect(oxi.construct("construct where { ?s ?p ?o }", { default: [g1] }))
				.resolves.toEqual([[named(s), named(p), typed("1")]]);

		});

		it("rejects update datasets", async () => {

			const oxi = await fixture();

			await expect(oxi.update("delete where { ?s ?p ?o }", { default: [g1] })).rejects.toThrow();

		});

	});

	describe("graph store", () => {

		const s = "http://example.org/s";
		const p = "http://example.org/p";

		const g1 = "http://example.org/g1";
		const g2 = "http://example.org/g2";


		/**
		 * Creates a repository holding one statement in the default graph and one in each of the graphs `g1` and `g2`.
		 */
		async function fixture() {

			const oxi = createOxiRepository();

			await oxi.update(`insert data {
				<${s}> <${p}> "0"
				graph <${g1}> { <${s}> <${p}> "1" }
				graph <${g2}> { <${s}> <${p}> "2" }
			}`);

			return oxi;

		}

		/**
		 * Lists the objects held by a graph, in lexical order.
		 */
		async function objects(oxi: Repository, graph?: string) {

			const rows = await oxi.select(graph === undefined
				? "select ?o { ?s ?p ?o } order by ?o"
				: `select ?o { graph <${graph}> { ?s ?p ?o } } order by ?o`
			);

			return rows.map(row => row["?o"]);

		}


		it("merges triples into a named graph, keeping its content", async () => {

			const oxi = await fixture();

			await oxi.merge([triple(named(s), named(p), typed("3"))], g1);

			expect(await objects(oxi, g1)).toEqual([typed("1"), typed("3")]);
			expect(await objects(oxi, g2)).toEqual([typed("2")]);
			expect(await objects(oxi)).toEqual([typed("0")]);

		});

		it("merges triples into the default graph, keeping its content", async () => {

			const oxi = await fixture();

			await oxi.merge([triple(named(s), named(p), typed("3"))]);

			expect(await objects(oxi)).toEqual([typed("0"), typed("3")]);
			expect(await objects(oxi, g1)).toEqual([typed("1")]);

		});

		it("creates a missing named graph", async () => {

			const oxi = await fixture();
			const g3 = "http://example.org/g3";

			await oxi.merge([triple(named(s), named(p), typed("3"))], g3);

			expect(await objects(oxi, g3)).toEqual([typed("3")]);

		});

		it("leaves the store unchanged when merging no triples", async () => {

			const oxi = await fixture();

			await oxi.merge([], g1);

			expect(await objects(oxi, g1)).toEqual([typed("1")]);

		});

		it("keeps merged blank nodes apart from those already in the store", async () => {

			const oxi = createOxiRepository();
			const statements = [triple(blank("x"), named(p), typed("1"))];

			await oxi.merge(statements, g1);
			await oxi.merge(statements, g1);

			await expect(oxi.select(`select (count(distinct ?s) as ?n) { graph <${g1}> { ?s ?p ?o } }`))
				.resolves.toEqual([{ "?n": typed("2", xsd.integer) }]);

		});

		it("stores triples as the content of a named graph, replacing it", async () => {

			const oxi = await fixture();

			await oxi.store([triple(named(s), named(p), typed("3"))], g1);

			expect(await objects(oxi, g1)).toEqual([typed("3")]);
			expect(await objects(oxi, g2)).toEqual([typed("2")]);
			expect(await objects(oxi)).toEqual([typed("0")]);

		});

		it("stores triples as the content of the default graph, replacing it", async () => {

			const oxi = await fixture();

			await oxi.store([triple(named(s), named(p), typed("3"))]);

			expect(await objects(oxi)).toEqual([typed("3")]);
			expect(await objects(oxi, g1)).toEqual([typed("1")]);

		});

		it("empties the graph when storing no triples", async () => {

			const oxi = await fixture();

			await oxi.store([], g1);

			expect(await objects(oxi, g1)).toEqual([]);
			expect(await objects(oxi, g2)).toEqual([typed("2")]);

		});

	});

});
