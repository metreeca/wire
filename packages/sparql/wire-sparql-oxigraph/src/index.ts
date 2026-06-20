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

/**
 * {@link https://oxigraph.org/ Oxigraph} in-memory WASM store connector for the
 * {@link https://github.com/metreeca/wire @metreeca/wire} storage connector collection.
 *
 * Exposes an Oxigraph WASM store, running entirely in-process with no external server required, through the common
 * {@link Repository} API.
 *
 * > [!IMPORTANT]
 * > **Transaction Isolation** — None. Updates apply immediately to the in-memory store, with no `execute` bracketing.
 *
 * @module oxigraph
 *
 * @see {@link https://github.com/oxigraph/oxigraph/blob/main/js/README.md Oxigraph JavaScript/WASM API}
 */

import { immutable } from "@metreeca/core/deep";
import { error } from "@metreeca/core/report";
import { createScope, type Scope } from "@metreeca/core/scope";
import type { Repository, Subject } from "@metreeca/wire-sparql";
import { blank, type Reference, tagged, type Term, typed, variable } from "@metreeca/wire-sparql";
import { type Quad as OxyQuad, Store as OxyStore, type Term as OxyTerm } from "oxigraph";


/**
 * Creates an in-memory {@link Repository} backed by an Oxigraph store.
 *
 * > [!IMPORTANT]
 * > **Transaction Isolation** — None. Updates apply immediately to the in-memory store, with no `execute` bracketing.
 *
 * @returns A {@link Repository} instance
 */
export function createOxiRepository(): Repository {

	const store = new OxyStore();


	const repository: Repository = immutable({

		ask(query) {

			return Promise.resolve(store.query(query) as boolean);

		},

		select(query) {

			const blanks = createScope();

			return Promise.resolve((store.query(query) as Map<string, OxyTerm>[]).map(row =>
				Object.fromEntries(Array.from(row, ([k, v]) => [variable(k), term(v, blanks)]))
			));

		},

		construct(query) {

			const blanks = createScope();

			return Promise.resolve((store.query(query) as OxyQuad[]).map(quad =>
				[subject(quad.subject, blanks), predicate(quad.predicate), object(quad.object, blanks)]
			));

		},

		update(update) {

			return Promise.resolve(store.update(update));

		},

		execute<V>(task: (repository: Repository) => V | Promise<V>): Promise<V> {

			return Promise.resolve(task(repository)); // no transaction support, run the task directly

		},

		close() {

			return Promise.resolve();

		}

	});

	return repository;


	function subject(value: OxyTerm, blanks: Scope): Subject {
		return value.termType === "BlankNode" ? blank(blanks.resolve(value.value))
			: value.termType === "NamedNode" ? value.value
				: error(new Error(`unsupported subject term type <${value.termType}>`));
	}

	function predicate(value: OxyTerm): Reference {
		return reference(value);
	}

	function object(value: OxyTerm, blanks: Scope): Term {
		return term(value, blanks);
	}


	function term(value: OxyTerm, blanks: Scope): Term {
		return value.termType === "BlankNode" ? blank(blanks.resolve(value.value))
			: value.termType === "NamedNode" ? value.value
				: value.termType === "Literal" && value.language ? tagged(value.value, value.language)
					: value.termType === "Literal" ? typed(value.value, reference(value.datatype))
						: error(new Error(`unsupported term type <${value.termType}>`));
	}

	function reference(term: OxyTerm): Reference {
		return term.termType === "NamedNode" ? term.value
			: error(new Error(`unsupported reference term type <${term.termType}>`));
	}

}
