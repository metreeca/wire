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

import { error } from "@metreeca/core";
import { immutable } from "@metreeca/core/values";
import { type IRI } from "@metreeca/core/resource";
import { createScope, type Scope } from "@metreeca/core/scope";
import {
	type Blank,
	blank,
	named,
	type Predicate,
	type Subject,
	tagged,
	type Term,
	type Triple,
	typed
} from "@metreeca/trio";
import { encodeNTriples, NTriples } from "@metreeca/trio/ntriples";
import type { Dataset, Repository } from "@metreeca/wire-sparql";
import { variable } from "@metreeca/wire-sparql";
import { drop, silent } from "@metreeca/wire-sparql/builder";
import {
	defaultGraph,
	type NamedNode as OxyNamedNode,
	namedNode,
	type Quad as OxyQuad,
	Store as OxyStore,
	type Term as OxyTerm
} from "oxigraph";


/**
 * Creates an in-memory {@link Repository} backed by an Oxigraph store.
 *
 * > [!IMPORTANT]
 * > **Transaction Isolation** — None. Updates apply immediately to the in-memory store, with no `execute` bracketing.
 *
 * > [!WARNING]
 * > The store applies a {@link Dataset} to queries only: an update given a dataset listing any graphs is rejected with
 * > an `Error` and leaves the store unchanged, as Oxigraph offers no way to run an update against a dataset.
 *
 * {@link Repository.merge | merge} and {@link Repository.store | store} load their triples straight into the store,
 * without parsing them as SPARQL text, and keep merged blank nodes apart from those already stored.
 *
 * @returns A {@link Repository} instance
 */
export function createOxiRepository(): Repository {

	const store = new OxyStore();


	const repository: Repository = immutable({

		ask(query, dataset) {

			return Promise.resolve(store.query(query, options(dataset)) as boolean);

		},

		select(query, dataset) {

			const blanks = createScope(blank);

			return Promise.resolve((store.query(query, options(dataset)) as Map<string, OxyTerm>[]).map(row =>
				Object.fromEntries(Array.from(row, ([k, v]) => [variable(k), term(v, blanks)]))
			));

		},

		construct(query, dataset) {

			const blanks = createScope(blank);

			return Promise.resolve((store.query(query, options(dataset)) as OxyQuad[]).map(quad =>
				[subject(quad.subject, blanks), predicate(quad.predicate), object(quad.object, blanks)]
			));

		},

		update(update, dataset) {

			return isEmpty(dataset)
				? Promise.resolve(store.update(update))
				: Promise.reject(new Error("unsupported update dataset"));

		},

		merge(triples, graph) {

			return Promise.resolve(load(triples, graph));

		},

		store(triples, graph) {

			store.update(silent(drop(graph ?? "default")));

			return Promise.resolve(load(triples, graph));

		},

		execute<V>(task: (repository: Repository) => V | Promise<V>): Promise<V> {

			return Promise.resolve(task(repository)); // no transaction support, run the task directly

		},

		close() {

			return Promise.resolve();

		}

	});

	return repository;


	/**
	 * Loads triples into a graph of the store, the default one when `graph` is omitted.
	 */
	function load(triples: readonly Triple[], graph?: IRI): void {
		store.load(encodeNTriples(triples), {
			format: NTriples,
			to_graph_name: graph === undefined ? defaultGraph() : namedNode(graph)
		});
	}

	/**
	 * Checks whether a dataset lists no graphs, leaving the dataset declared by the request text in effect.
	 */
	function isEmpty({ default: graphs = [], named = [] }: Dataset = {}): boolean {
		return graphs.length === 0 && named.length === 0;
	}


	/**
	 * Converts a dataset into Oxigraph query options, overriding the dataset declared by the query text.
	 */
	function options(dataset: Dataset = {}): {

		readonly default_graph?: readonly OxyNamedNode[];
		readonly named_graphs?: readonly OxyNamedNode[];

	} {
		return isEmpty(dataset) ? {} : {
			default_graph: (dataset.default ?? []).map(iri => namedNode(iri)),
			named_graphs: (dataset.named ?? []).map(iri => namedNode(iri))
		};
	}


	function subject(value: OxyTerm, blanks: Scope<Blank>): Subject {
		return value.termType === "BlankNode" ? blanks.resolve(value.value)
			: value.termType === "NamedNode" ? named(value.value)
				: error(new Error(`unsupported subject term type <${value.termType}>`));
	}

	function predicate(value: OxyTerm): Predicate {
		return named(name(value));
	}

	function object(value: OxyTerm, blanks: Scope<Blank>): Term {
		return term(value, blanks);
	}


	function term(value: OxyTerm, blanks: Scope<Blank>): Term {
		return value.termType === "BlankNode" ? blanks.resolve(value.value)
			: value.termType === "NamedNode" ? named(value.value)
				: value.termType === "Literal" && value.language ? tagged(value.value, value.language)
					: value.termType === "Literal" ? typed(value.value, name(value.datatype))
						: error(new Error(`unsupported term type <${value.termType}>`));
	}

	function name(term: OxyTerm): IRI {
		return term.termType === "NamedNode" ? term.value
			: error(new Error(`unsupported named term type <${term.termType}>`));
	}

}
