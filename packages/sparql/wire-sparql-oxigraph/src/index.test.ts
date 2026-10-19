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

import { named, typed } from "@metreeca/trio";
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

});
