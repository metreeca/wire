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
 * Builders for SPARQL queries and updates.
 *
 * Provides composable combinators that assemble SPARQL request strings from typed fragments: update and graph
 * management operations, query forms, graph patterns, property paths, expressions, aggregates, solution modifiers, and
 * the serialisers that render RDF {@link Term | terms} into their SPARQL lexical forms. Every combinator takes and
 * returns {@link SPARQL} fragments, so clauses nest by ordinary function composition into a complete query or update.
 *
 * Term content is escaped wherever the grammar defines an escape and validated wherever it does not, so no value
 * rendered through the serialisers can break out of the token carrying it.
 *
 * > [!WARNING]
 * > Blank-node labels are the exception: `BLANK_NODE_LABEL` defines no escape and {@link blank} performs no check, so
 * > a malformed label breaks the fragment carrying it rather than rendering as data.
 *
 * **Types**
 *
 * - {@link Mixed} — the spread-or-array argument shape accepted by the variadic combinators
 *
 * **Prologue**
 *
 * - {@link base} — base IRI for relative references
 *
 * **Updates**
 *
 * - {@link update} — sequence operations into a single request
 * - {@link deleet}, {@link insert}, {@link data} — delete/insert clauses and their ground data blocks
 * - {@link witt}, {@link using}, {@link usingNamed} — target graph and update dataset
 *
 * **Graph management**
 *
 * - {@link load}, {@link clear}, {@link create}, {@link drop} — graph loading, emptying, creation and removal
 * - {@link copy}, {@link move}, {@link aad} — graph-to-graph transfers
 * - {@link silent} — `silent` form of graph management operations and {@link service} blocks
 *
 * **Queries**
 *
 * - {@link select}, {@link construct}, {@link ask}, {@link describe} — query forms
 * - {@link all}, {@link distinct}, {@link reduced}, {@link as} — projection wildcard, modifiers, and aliases
 * - {@link from}, {@link fromNamed} — query dataset
 * - {@link groupBy}, {@link having}, {@link orderBy}, {@link asc}, {@link desc}, {@link limit},
 *   {@link offset} — solution modifiers
 *
 * **Graph patterns**
 *
 * - {@link where} — query body and update solution source
 * - {@link edge}, {@link group}, {@link fragment} — statements, blocks, and clause joining
 * - {@link union}, {@link optional}, {@link minus}, {@link graph}, {@link service}, {@link values} — pattern algebra
 * - {@link filter}, {@link bind} — constraints and in-body assignments
 * - {@link nil} — the empty fragment, dropped wherever clauses are joined
 *
 * **Property paths**
 *
 * - {@link seq}, {@link alt}, {@link inv}, {@link star}, {@link plus}, {@link opt}, {@link none} — path operators
 *
 * **Expressions**
 *
 * - {@link not}, {@link and}, {@link or} — logical operators
 * - {@link eq}, {@link ne}, {@link lt}, {@link gt}, {@link lte}, {@link gte} — comparison operators
 * - {@link add}, {@link sub}, {@link mul}, {@link div}, {@link neg} — arithmetic operators
 * - {@link iif}, {@link coalesce}, {@link isBound}, {@link isIn}, {@link isNotIn}, {@link exists},
 *   {@link nexists}, {@link call} — functional forms
 *
 * **Built-in functions**
 *
 * - {@link str}, {@link lang}, {@link datatype}, {@link isBlank}, {@link isIRI}, {@link isLiteral},
 *   {@link isNumeric}, {@link sameTerm}, {@link iri}, {@link bnode}, {@link strdt}, {@link strlang}, {@link uuid},
 *   {@link struuid} — RDF term functions
 * - {@link strlen}, {@link substr}, {@link ucase}, {@link lcase}, {@link strstarts}, {@link strends},
 *   {@link contains}, {@link strbefore}, {@link strafter}, {@link encodeForUri}, {@link concat},
 *   {@link langMatches}, {@link regex}, {@link replace} — string functions
 * - {@link abs}, {@link round}, {@link ceil}, {@link floor}, {@link rand} — numeric functions
 * - {@link now}, {@link year}, {@link month}, {@link day}, {@link hours}, {@link minutes}, {@link seconds},
 *   {@link timezone}, {@link tz} — temporal functions
 * - {@link md5}, {@link sha1}, {@link sha256}, {@link sha384}, {@link sha512} — hash functions
 *
 * **Aggregates**
 *
 * - {@link count}, {@link sum}, {@link min}, {@link max}, {@link avg}, {@link sample},
 *   {@link groupConcat} — aggregate expressions over grouped solutions
 *
 * **Serialisers**
 *
 * - {@link patterns}, {@link pattern}, {@link anchor}, {@link variable} — triple patterns and query variables
 * - {@link triples}, {@link triple}, {@link term}, {@link blank}, {@link reference} — RDF statements and terms
 * - {@link typed}, {@link tagged}, {@link boolean}, {@link number}, {@link string} — literals
 *
 * **Usage**
 *
 * Combinators nest as plain expressions, so a whole request is written as one composition:
 *
 * ```ts
 * const product = variable("product"); // ?product, minted by the package entry module
 * const name = variable("name");       // ?name
 *
 * const query = select([name],
 *     where(
 *         edge(product, reference("https://schema.org/name"), name),
 *         filter(langMatches(lang(name), "en"))
 *     ),
 *     orderBy(asc(name)),
 *     limit(10)
 * );
 * ```
 *
 * @module
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/ SPARQL 1.1 Query Language}
 * @see {@link https://www.w3.org/TR/sparql11-update/ SPARQL 1.1 Update}
 * @see {@link https://www.w3.org/TR/rdf11-concepts/ RDF 1.1 Concepts}
 */

import { error, type Identifier, isString, map } from "@metreeca/core";
import { xsd } from "@metreeca/core/datatype";
import { isTag, type Tag, type TagRange } from "@metreeca/core/language";
import { type IRI, isIRI as isReference } from "@metreeca/core/resource";
import { escape, isWellFormed } from "@metreeca/core/strings";
import { rdf, type Term, type Triple } from "@metreeca/trio";
import { type Pattern, type SPARQL, type Variable } from "./index.js";


/**
 * Matches every character {@link reference} escapes within an IRIREF.
 *
 * Covers the supplementary code points above U+FFFF, the only characters an escape can carry into a SPARQL IRIREF:
 * escapes are resolved into code points before parsing, and the characters the production forbids are not legal at
 * that point in the grammar, so no escape can express them and {@link reference} rejects them instead.
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#codepointEscape SPARQL 1.1 §19.2 — Codepoint Escape Sequences}
 */
const IRIEscapePattern = /[\u{10000}-\u{10FFFF}]/gu;



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * A variadic parameter mixing bare values and arrays of values in a single argument list.
 *
 * Widens a rest parameter so a combinator accepts both spread values (`f(a, b, c)`) and a pre-built array
 * (`f([a, b, c])`), sparing callers a spread when passing the result of an array-returning helper. Combinators
 * flatten the arguments one level before use.
 */
export type Mixed<T> = readonly (T | readonly T[])[];


//// Prologue (§4.1.1) /////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL `BASE` declaration.
 *
 * The declaration applies to the query or update it is joined ahead of with {@link fragment}.
 *
 * @param iri - The base IRI
 *
 * @returns The SPARQL `BASE` declaration
 *
 * @throws RangeError if `iri` is not a well-formed RFC 3987 reference
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#relIRIs SPARQL 1.1 Relative IRIs}
 */
export function base(iri: IRI): SPARQL {

	return `base ${reference(iri)}`;

}


//// Updates (Update §3) ///////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL update request.
 *
 * Joins the operations with `;`, dropping empty ones such as those produced by {@link nil}.
 *
 * @param updates - The update operations, in order
 *
 * @returns The `;`-separated SPARQL update request, excluding empty operations
 *
 * @see {@link https://www.w3.org/TR/sparql11-update/ SPARQL 1.1 Update}
 */
export function update(...updates: Mixed<SPARQL>): SPARQL {

	return updates.flat().filter(operation => operation !== "").join("; ");

}

/**
 * Generates a SPARQL `DELETE` clause.
 *
 * Prefixes the space-joined clauses with `delete`, so the clauses select the form: `deleet(data(…))`,
 * `deleet(group(…), where(…))` or `deleet(where(…))`. Joined with an {@link insert} clause through {@link fragment},
 * it forms a combined operation. Empty clauses are dropped; when none survives, the result is the empty fragment.
 *
 * > [!WARNING]
 * > An empty {@link group} renders as the empty fragment, turning `deleet(group(…), where(…))` into `delete where`,
 * > which removes every triple the pattern matches: guard templates computed from possibly empty input.
 *
 * @param clauses - The clauses: a {@link data} block, a template {@link group} and a {@link where}, or a {@link where}
 *
 * @returns The SPARQL `DELETE` clause, or the empty fragment for no clauses
 *
 * @see {@link https://www.w3.org/TR/sparql11-update/#deleteData SPARQL 1.1 Update — Delete Data}
 * @see {@link https://www.w3.org/TR/sparql11-update/#deleteInsert SPARQL 1.1 Update — Delete/Insert}
 * @see {@link https://www.w3.org/TR/sparql11-update/#deleteWhere SPARQL 1.1 Update — Delete Where}
 */
export function deleet(...clauses: Mixed<SPARQL>): SPARQL {

	return map(clauses.flat().filter(clause => clause !== ""), clauses =>
		clauses.length === 0 ? nil() : `delete ${fragment(clauses)}`
	);

}

/**
 * Generates a SPARQL `INSERT` clause.
 *
 * Prefixes the space-joined clauses with `insert`, so the clauses select the form: `insert(data(…))` or
 * `insert(group(…), where(…))`. Empty clauses are dropped; when none survives, the result is the empty fragment.
 *
 * @param clauses - The operation clauses: a {@link data} block, or a template {@link group} and a {@link where} clause
 *
 * @returns The SPARQL `INSERT` clause, or the empty fragment for no clauses
 *
 * @see {@link https://www.w3.org/TR/sparql11-update/#insertData SPARQL 1.1 Update — Insert Data}
 * @see {@link https://www.w3.org/TR/sparql11-update/#deleteInsert SPARQL 1.1 Update — Delete/Insert}
 */
export function insert(...clauses: Mixed<SPARQL>): SPARQL {

	return map(clauses.flat().filter(clause => clause !== ""), clauses =>
		clauses.length === 0 ? nil() : `insert ${fragment(clauses)}`
	);

}

/**
 * Generates a SPARQL `DATA` block for {@link deleet} or {@link insert}.
 *
 * Empty triples are dropped; when none survives, the result is the empty fragment, dropping the enclosing operation.
 *
 * @param triples - The ground triples, or {@link graph} blocks over them
 *
 * @returns The SPARQL `DATA` block, or the empty fragment for no triples
 *
 * @see {@link https://www.w3.org/TR/sparql11-update/#insertData SPARQL 1.1 Update — Insert Data}
 * @see {@link https://www.w3.org/TR/sparql11-update/#deleteData SPARQL 1.1 Update — Delete Data}
 */
export function data(...triples: Mixed<SPARQL>): SPARQL {

	return map(triples.flat().filter(triple => triple !== ""), triples =>
		triples.length === 0 ? nil() : `data { ${fragment(triples)} }`
	);

}


/**
 * Generates a SPARQL `WITH` clause.
 *
 * Prefixes the clauses with `with <graph>`. Empty clauses are dropped; when none survives, the result is the empty
 * fragment, and an enclosing {@link update} request drops the operation rather than emitting a bare `with`.
 *
 * @param graph - The IRI of the target graph
 * @param clauses - The template operation clauses
 *
 * @returns The SPARQL `WITH` update, or the empty fragment for no clauses
 *
 * @see {@link https://www.w3.org/TR/sparql11-update/#deleteInsert SPARQL 1.1 Update — Delete/Insert}
 */
export function witt(graph: IRI, ...clauses: Mixed<SPARQL>): SPARQL {

	return map(clauses.flat().filter(clause => clause !== ""), clauses =>
		clauses.length === 0 ? nil() : `with ${reference(graph)} ${fragment(clauses)}`
	);

}

/**
 * Generates SPARQL `USING` clauses.
 *
 * Emits one `using <graph>` clause per graph. Empty graphs are dropped; with none left, the result is empty.
 *
 * @param graphs - The IRIs of the default graphs
 *
 * @returns The space-joined SPARQL `USING` clauses, or the empty fragment for no graphs
 *
 * @see {@link https://www.w3.org/TR/sparql11-update/#deleteInsert SPARQL 1.1 Update — Delete/Insert}
 */
export function using(...graphs: Mixed<IRI>): SPARQL {

	return map(graphs.flat().filter(graph => graph !== ""), graphs =>
		graphs.length === 0 ? nil() : graphs.map(graph => `using ${reference(graph)}`).join(" ")
	);

}

/**
 * Generates SPARQL `USING NAMED` clauses.
 *
 * Emits one `using named <graph>` clause per graph. Empty graphs are dropped; with none left, the result is empty.
 *
 * @param graphs - The IRIs of the named graphs
 *
 * @returns The space-joined SPARQL `USING NAMED` clauses, or the empty fragment for no graphs
 *
 * @see {@link https://www.w3.org/TR/sparql11-update/#deleteInsert SPARQL 1.1 Update — Delete/Insert}
 */
export function usingNamed(...graphs: Mixed<IRI>): SPARQL {

	return map(graphs.flat().filter(graph => graph !== ""), graphs =>
		graphs.length === 0 ? nil() : graphs.map(graph => `using named ${reference(graph)}`).join(" ")
	);

}


//// Graph Management (Update §3.2) ////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL `LOAD` update.
 *
 * @param source - The IRI of the RDF document to load
 * @param into - The IRI of the target graph, or omitted for the default graph
 *
 * @returns The SPARQL `LOAD` update
 *
 * @throws RangeError if `source` or `into` is not a well-formed RFC 3987 reference
 *
 * @see {@link https://www.w3.org/TR/sparql11-update/#load SPARQL 1.1 Update — LOAD}
 */
export function load(source: IRI, into?: IRI): SPARQL {

	return fragment("load", reference(source), into === undefined ? nil() : `into graph ${reference(into)}`);

}

/**
 * Generates a SPARQL `CLEAR` update.
 *
 * The keywords `"default"`, `"named"` and `"all"` render as such; any other target renders as `graph <iri>`, so a
 * relative IRI spelled as a keyword needs a `./` prefix to be addressed as a graph.
 *
 * @param target - The IRI of the graph to clear, or a graph keyword
 *
 * @returns The SPARQL `CLEAR` update
 *
 * @throws RangeError if `target` is neither a keyword nor a well-formed RFC 3987 reference
 *
 * @see {@link https://www.w3.org/TR/sparql11-update/#clear SPARQL 1.1 Update — CLEAR}
 */
export function clear(target: "default" | "named" | "all" | IRI): SPARQL {

	return `clear ${scope(target)}`;

}

/**
 * Generates a SPARQL `CREATE` update.
 *
 * @param graph - The IRI of the graph to create
 *
 * @returns The SPARQL `CREATE` update
 *
 * @throws RangeError if `graph` is not a well-formed RFC 3987 reference
 *
 * @see {@link https://www.w3.org/TR/sparql11-update/#create SPARQL 1.1 Update — CREATE}
 */
export function create(graph: IRI): SPARQL {

	return `create graph ${reference(graph)}`;

}

/**
 * Generates a SPARQL `DROP` update.
 *
 * The keywords `"default"`, `"named"` and `"all"` render as such; any other target renders as `graph <iri>`, so a
 * relative IRI spelled as a keyword needs a `./` prefix to be addressed as a graph.
 *
 * @param target - The IRI of the graph to drop, or a graph keyword
 *
 * @returns The SPARQL `DROP` update
 *
 * @throws RangeError if `target` is neither a keyword nor a well-formed RFC 3987 reference
 *
 * @see {@link https://www.w3.org/TR/sparql11-update/#drop SPARQL 1.1 Update — DROP}
 */
export function drop(target: "default" | "named" | "all" | IRI): SPARQL {

	return `drop ${scope(target)}`;

}

/**
 * Generates a SPARQL `COPY` update.
 *
 * The keyword `"default"` renders as such; any other graph renders as `graph <iri>`, so a relative IRI spelled as
 * the keyword needs a `./` prefix to be addressed as a graph rather than as the default one.
 *
 * @param source - The IRI of the source graph, or `"default"`
 * @param target - The IRI of the target graph, or `"default"`
 *
 * @returns The SPARQL `COPY` update
 *
 * @throws RangeError if `source` or `target` is neither `"default"` nor a well-formed RFC 3987 reference
 *
 * @see {@link https://www.w3.org/TR/sparql11-update/#copy SPARQL 1.1 Update — COPY}
 */
export function copy(source: "default" | IRI, target: "default" | IRI): SPARQL {

	return `copy ${origin(source)} to ${origin(target)}`;

}

/**
 * Generates a SPARQL `MOVE` update.
 *
 * The keyword `"default"` renders as such; any other graph renders as `graph <iri>`, so a relative IRI spelled as
 * the keyword needs a `./` prefix to be addressed as a graph rather than as the default one.
 *
 * @param source - The IRI of the source graph, or `"default"`
 * @param target - The IRI of the target graph, or `"default"`
 *
 * @returns The SPARQL `MOVE` update
 *
 * @throws RangeError if `source` or `target` is neither `"default"` nor a well-formed RFC 3987 reference
 *
 * @see {@link https://www.w3.org/TR/sparql11-update/#move SPARQL 1.1 Update — MOVE}
 */
export function move(source: "default" | IRI, target: "default" | IRI): SPARQL {

	return `move ${origin(source)} to ${origin(target)}`;

}

/**
 * Generates a SPARQL `ADD` update.
 *
 * The keyword `"default"` renders as such; any other graph renders as `graph <iri>`, so a relative IRI spelled as
 * the keyword needs a `./` prefix to be addressed as a graph rather than as the default one.
 *
 * @param source - The IRI of the source graph, or `"default"`
 * @param target - The IRI of the target graph, or `"default"`
 *
 * @returns The SPARQL `ADD` update
 *
 * @throws RangeError if `source` or `target` is neither `"default"` nor a well-formed RFC 3987 reference
 *
 * @see {@link https://www.w3.org/TR/sparql11-update/#add SPARQL 1.1 Update — ADD}
 */
export function aad(source: "default" | IRI, target: "default" | IRI): SPARQL {

	return `add ${origin(source)} to ${origin(target)}`;

}

/**
 * Generates the SPARQL `SILENT` form of an operation.
 *
 * Inserts `silent` after the leading keyword of a {@link load}, {@link clear}, {@link create}, {@link drop},
 * {@link copy}, {@link move}, {@link aad} or {@link service} fragment; the empty fragment is returned unchanged.
 *
 * @param operation - The operation to modify
 *
 * @returns The `silent` form of `operation`, or the empty fragment for an empty `operation`
 *
 * @see {@link https://www.w3.org/TR/sparql11-update/#graphManagement SPARQL 1.1 Update — Graph Management}
 * @see {@link https://www.w3.org/TR/sparql11-federated-query/#serviceFailure SPARQL 1.1 Federated Query — SILENT}
 */
export function silent(operation: SPARQL): SPARQL {

	return operation.replace(/^\S+/, keyword => `${keyword} silent`);

}


//// Queries (§13/§15/§16) /////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL `ASK` query.
 *
 * @param clauses - The query clauses, typically a {@link where} clause
 *
 * @returns The SPARQL `ASK` query
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#ask SPARQL 1.1 ASK}
 */
export function ask(...clauses: Mixed<SPARQL>): SPARQL {

	return `ask ${fragment(...clauses)}`;

}

/**
 * Generates a SPARQL `SELECT` query.
 *
 * @param projection - The projection: a single expression, such as {@link all}, or a list of variables and aliases
 * @param clauses - The query clauses, typically a {@link where} clause followed by solution modifiers
 *
 * @returns The SPARQL `SELECT` query
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#select SPARQL 1.1 SELECT}
 */
export function select(projection: SPARQL | readonly SPARQL[], ...clauses: Mixed<SPARQL>): SPARQL {

	return `select ${isString(projection) ? projection : fragment(projection)} ${fragment(...clauses)}`;

}

/**
 * Generates a SPARQL `CONSTRUCT` query.
 *
 * @param template - The triple template: a single fragment, or a list of triple patterns joined into a fragment
 * @param clauses - The query clauses, typically a {@link where} clause followed by solution modifiers
 *
 * @returns The SPARQL `CONSTRUCT` query
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#construct SPARQL 1.1 CONSTRUCT}
 */
export function construct(template: SPARQL | readonly SPARQL[], ...clauses: Mixed<SPARQL>): SPARQL {

	return fragment(`construct { ${isString(template) ? template : fragment(template)} }`, ...clauses);

}

/**
 * Generates a SPARQL `DESCRIBE` query.
 *
 * @param resources - The resources: a single fragment, such as {@link all}, or a list of variables and IRI references
 * @param clauses - The query clauses, typically a {@link where} clause followed by solution modifiers
 *
 * @returns The SPARQL `DESCRIBE` query
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#describe SPARQL 1.1 DESCRIBE}
 */
export function describe(resources: SPARQL | readonly SPARQL[], ...clauses: Mixed<SPARQL>): SPARQL {

	return fragment("describe", isString(resources) ? resources : fragment(resources), ...clauses);

}

/**
 * Generates a SPARQL `distinct` modifier for a projection or an aggregate argument.
 *
 * Empty expressions are dropped; when none survives, the result is the empty fragment.
 *
 * @param expressions - The projection variables or the aggregate argument
 *
 * @returns The `distinct` modifier, or the empty fragment for no expressions
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#modDuplicates SPARQL 1.1 Duplicate Solutions}
 */
export function distinct(...expressions: Mixed<SPARQL>): SPARQL {

	return map(expressions.flat().filter(expression => expression !== ""), expressions =>
		expressions.length === 0 ? nil() : `distinct ${fragment(expressions)}`
	);

}

/**
 * Generates a SPARQL `reduced` modifier for a projection.
 *
 * Empty expressions are dropped; when none survives, the result is the empty fragment.
 *
 * @param expressions - The projection variables
 *
 * @returns The `reduced` modifier, or the empty fragment for no expressions
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#modReduced SPARQL 1.1 Reduced Solutions}
 */
export function reduced(...expressions: Mixed<SPARQL>): SPARQL {

	return map(expressions.flat().filter(expression => expression !== ""), expressions =>
		expressions.length === 0 ? nil() : `reduced ${fragment(expressions)}`
	);

}

/**
 * Generates the SPARQL `*` projection wildcard.
 *
 * @returns The `*` wildcard
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#select SPARQL 1.1 SELECT}
 */
export function all() {

	return "*";

}

/**
 * Generates a SPARQL projection alias.
 *
 * @param expression - The projected expression
 * @param variable - The result variable
 *
 * @returns The parenthesised `(… as …)` projection alias
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#selectExpressions SPARQL 1.1 Select Expressions}
 */
export function as(expression: SPARQL, variable: SPARQL): SPARQL {

	return `(${expression} as ${variable})`;

}


/**
 * Generates SPARQL `FROM` clauses.
 *
 * Emits one `from <graph>` clause per graph. Empty graphs are dropped; with none left, the result is empty.
 *
 * @param graphs - The IRIs of the default graphs
 *
 * @returns The space-joined SPARQL `FROM` clauses, or the empty fragment for no graphs
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#specifyingDataset SPARQL 1.1 Specifying RDF Datasets}
 */
export function from(...graphs: Mixed<IRI>): SPARQL {

	return map(graphs.flat().filter(graph => graph !== ""), graphs =>
		graphs.length === 0 ? nil() : graphs.map(graph => `from ${reference(graph)}`).join(" ")
	);

}

/**
 * Generates SPARQL `FROM NAMED` clauses.
 *
 * Emits one `from named <graph>` clause per graph. Empty graphs are dropped; with none left, the result is empty.
 *
 * @param graphs - The IRIs of the named graphs
 *
 * @returns The space-joined SPARQL `FROM NAMED` clauses, or the empty fragment for no graphs
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#specifyingDataset SPARQL 1.1 Specifying RDF Datasets}
 */
export function fromNamed(...graphs: Mixed<IRI>): SPARQL {

	return map(graphs.flat().filter(graph => graph !== ""), graphs =>
		graphs.length === 0 ? nil() : graphs.map(graph => `from named ${reference(graph)}`).join(" ")
	);

}


/**
 * Generates a SPARQL `GROUP BY` clause.
 *
 * Empty expressions are dropped; when none survives, the result is the empty fragment.
 *
 * @param expressions - The grouping expressions
 *
 * @returns The SPARQL `GROUP BY` clause, or the empty fragment for no expressions
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#aggregates SPARQL 1.1 Aggregates}
 */
export function groupBy(...expressions: Mixed<SPARQL>): SPARQL {

	return map(expressions.flat().filter(expression => expression !== ""), expressions =>
		expressions.length === 0 ? nil() : `group by ${fragment(expressions)}`
	);

}

/**
 * Generates a SPARQL `HAVING` clause.
 *
 * Several conditions are each bracketed and conjoined with `&&`, the form portable across engines, rather than
 * listed one after another. Empty conditions are dropped; when none survives, the result is the empty fragment.
 *
 * @param conditions - The boolean constraints
 *
 * @returns The SPARQL `HAVING` clause, or the empty fragment for no conditions
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#aggregates SPARQL 1.1 Aggregates}
 */
export function having(...conditions: Mixed<SPARQL>): SPARQL {

	return map(conditions.flat().filter(condition => condition !== ""), conditions =>
		conditions.length === 0 ? nil()
			: conditions.length === 1 ? `having (${conditions[0]})`
				: `having ${and(conditions.map(condition => `(${condition})`))}`
	);

}

/**
 * Generates a SPARQL `ORDER BY` clause.
 *
 * Empty conditions are dropped; when none survives, the result is the empty fragment.
 *
 * @param conditions - The order conditions: bare expressions or {@link asc} and {@link desc} wrappers
 *
 * @returns The SPARQL `ORDER BY` clause, or the empty fragment for no conditions
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#modOrderBy SPARQL 1.1 Order By}
 */
export function orderBy(...conditions: Mixed<SPARQL>): SPARQL {

	return map(conditions.flat().filter(condition => condition !== ""), conditions =>
		conditions.length === 0 ? nil() : `order by ${fragment(conditions)}`
	);

}

/**
 * Generates a SPARQL `asc()` order condition.
 *
 * @param expression - The ordering expression
 *
 * @returns The `asc(…)` order condition
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#modOrderBy SPARQL 1.1 Order By}
 */
export function asc(expression: SPARQL): SPARQL {

	return `asc(${expression})`;

}

/**
 * Generates a SPARQL `desc()` order condition.
 *
 * @param expression - The ordering expression
 *
 * @returns The `desc(…)` order condition
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#modOrderBy SPARQL 1.1 Order By}
 */
export function desc(expression: SPARQL): SPARQL {

	return `desc(${expression})`;

}

/**
 * Generates a SPARQL `LIMIT` clause.
 *
 * A `value` of `0` yields the empty fragment.
 *
 * @param value - The maximum number of solutions
 *
 * @returns The SPARQL `LIMIT` clause, or the empty fragment for a `value` of `0`
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#modResultLimit SPARQL 1.1 Limit}
 */
export function limit(value: number): SPARQL {

	return value === 0 ? nil() : `limit ${value}`;

}

/**
 * Generates a SPARQL `OFFSET` clause.
 *
 * A `value` of `0` yields the empty fragment.
 *
 * @param value - The number of solutions to skip
 *
 * @returns The SPARQL `OFFSET` clause, or the empty fragment for a `value` of `0`
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#modOffset SPARQL 1.1 Offset}
 */
export function offset(value: number): SPARQL {

	return value === 0 ? nil() : `offset ${value}`;

}


//// Query Clauses (§15) ///////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL `WHERE` clause.
 *
 * Empty clauses are dropped; when none survives, the result is the empty fragment.
 *
 * @param clauses - The graph pattern clauses
 *
 * @returns The SPARQL `WHERE` clause, or the empty fragment for no clauses
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#WritingSimpleQueries SPARQL 1.1 Writing Simple Queries}
 */
export function where(...clauses: Mixed<SPARQL>): SPARQL {

	return map(clauses.flat().filter(clause => clause !== ""), clauses =>
		clauses.length === 0 ? nil() : `where { ${fragment(clauses)} }`
	);

}


//// Graph Patterns (§8) ///////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL `UNION` pattern.
 *
 * Several clauses are each wrapped in a {@link group} and joined with `union`, while a single one is returned as is.
 * Empty clauses are dropped; when none survives, the result is the empty fragment.
 *
 * @param clauses - The alternative graph patterns
 *
 * @returns The SPARQL `UNION` pattern
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#alternatives SPARQL 1.1 Alternative Patterns}
 */
export function union(...clauses: Mixed<SPARQL>): SPARQL {

	return map(clauses.flat().filter(clause => clause !== ""), clauses =>
		clauses.length === 0 ? nil()
			: clauses.length === 1 ? clauses[0]
				: clauses.map(clause => group(clause)).join(" union ")
	);

}

/**
 * Generates a SPARQL `OPTIONAL` group pattern.
 *
 * Empty clauses are dropped; when none survives, the result is the empty fragment.
 *
 * @param clauses - The graph pattern clauses
 *
 * @returns The SPARQL `OPTIONAL` group pattern, or the empty fragment for no clauses
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#optionals SPARQL 1.1 Optional Patterns}
 */
export function optional(...clauses: Mixed<SPARQL>): SPARQL {

	return map(clauses.flat().filter(clause => clause !== ""), clauses =>
		clauses.length === 0 ? nil() : `optional { ${fragment(clauses)} }`
	);

}

/**
 * Generates a SPARQL group graph pattern.
 *
 * Empty clauses are dropped; when none survives, the result is the empty fragment.
 *
 * @param clauses - The graph pattern clauses
 *
 * @returns The braced SPARQL group pattern, or the empty fragment for no clauses
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#GroupPatterns SPARQL 1.1 Group Graph Patterns}
 */
export function group(...clauses: Mixed<SPARQL>): SPARQL {

	return map(clauses.flat().filter(clause => clause !== ""), clauses =>
		clauses.length === 0 ? nil() : `{ ${fragment(clauses)} }`
	);

}

/**
 * Generates a SPARQL `MINUS` pattern.
 *
 * Empty clauses are dropped; when none survives, the result is the empty fragment.
 *
 * @param clauses - The graph pattern clauses
 *
 * @returns The SPARQL `MINUS` pattern, or the empty fragment for no clauses
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#negation SPARQL 1.1 Negation}
 */
export function minus(...clauses: Mixed<SPARQL>): SPARQL {

	return map(clauses.flat().filter(clause => clause !== ""), clauses =>
		clauses.length === 0 ? nil() : `minus { ${fragment(clauses)} }`
	);

}

/**
 * Generates a SPARQL `GRAPH` block.
 *
 * Empty clauses are dropped; when none survives, the result is the empty fragment.
 *
 * @param name - The serialised graph name: a variable or an IRI reference
 * @param clauses - The graph pattern clauses
 *
 * @returns The SPARQL `GRAPH` block, or the empty fragment for no clauses
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#queryDataset SPARQL 1.1 Querying the Dataset}
 */
export function graph(name: SPARQL, ...clauses: Mixed<SPARQL>): SPARQL {

	return map(clauses.flat().filter(clause => clause !== ""), clauses =>
		clauses.length === 0 ? nil() : `graph ${name} { ${fragment(clauses)} }`
	);

}

/**
 * Generates a SPARQL `SERVICE` block.
 *
 * Empty clauses are dropped; when none survives, the result is the empty fragment.
 *
 * @param endpoint - The serialised endpoint: a variable or an IRI reference
 * @param clauses - The graph pattern clauses
 *
 * @returns The SPARQL `SERVICE` block, or the empty fragment for no clauses
 *
 * @see {@link https://www.w3.org/TR/sparql11-federated-query/#service SPARQL 1.1 Federated Query — SERVICE}
 */
export function service(endpoint: SPARQL, ...clauses: Mixed<SPARQL>): SPARQL {

	return map(clauses.flat().filter(clause => clause !== ""), clauses =>
		clauses.length === 0 ? nil() : `service ${endpoint} { ${fragment(clauses)} }`
	);

}

/**
 * Generates a SPARQL `VALUES` inline-data block.
 *
 * Empty variables and terms are dropped, so an unbound position must use `undef` rather than an empty fragment to keep
 * rows aligned with the variable list. An empty row list yields an empty `values (…) { }` block.
 *
 * @param variables - The serialised variables
 * @param rows - The value rows, each a list of serialised terms aligned with `variables`
 *
 * @returns The SPARQL `VALUES` block
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#inline-data SPARQL 1.1 Inline Data}
 */
export function values(variables: readonly SPARQL[], rows: readonly (readonly SPARQL[])[]): SPARQL {

	return `values (${variables.filter(variable => variable !== "").join(" ")}) { ${fragment(rows.map(row =>
		`(${row.filter(term => term !== "").join(" ")})`
	))} }`;

}

/**
 * Generates a {@link SPARQL} fragment by space-joining clauses.
 *
 * Empty clauses, such as those produced by {@link nil}, are dropped before joining.
 *
 * @param clauses - The clauses to join
 *
 * @returns The space-joined fragment, excluding empty clauses
 */
export function fragment(...clauses: Mixed<SPARQL>): SPARQL {

	return clauses.flat().filter(clause => clause !== "").join(" ");

}

/**
 * Generates a SPARQL `subject predicate object .` statement from serialised terms.
 *
 * @param subject - The serialised subject term
 * @param predicate - The serialised predicate term
 * @param object - The serialised object term
 *
 * @returns The `subject predicate object .` statement
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#QSynTriples SPARQL 1.1 Triple Patterns}
 */
export function edge(subject: SPARQL, predicate: SPARQL, object: SPARQL): SPARQL {

	return `${subject} ${predicate} ${object} .`;

}

/**
 * Generates a SPARQL `FILTER` constraint.
 *
 * @param constraint - The boolean constraint
 *
 * @returns The SPARQL `FILTER` constraint
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#expressions SPARQL 1.1 Filters}
 */
export function filter(constraint: SPARQL): SPARQL {

	return `filter(${constraint})`;

}

/**
 * Generates a SPARQL `bind` clause.
 *
 * @param expression - The bound expression
 * @param variable - The target variable
 *
 * @returns The `bind(… as …)` clause
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#bind SPARQL 1.1 Bind}
 */
export function bind(expression: SPARQL, variable: SPARQL): SPARQL {

	return `bind(${expression} as ${variable})`;

}

/**
 * Generates an empty {@link SPARQL} fragment.
 *
 * @returns The empty string
 */
export function nil(): SPARQL {

	return "";

}


//// Property Paths (§9) ///////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL sequence property path.
 *
 * Drops empty elements, then brackets and joins several survivors with `/`, returning a single one as is.
 *
 * @param paths - The path elements, in traversal order
 *
 * @returns The bracketed `/`-joined sequence path, the single surviving element, or the empty fragment for none
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#propertypaths SPARQL 1.1 Property Paths}
 */
export function seq(...paths: Mixed<SPARQL>): SPARQL {

	return infix("/", paths.flat());

}

/**
 * Generates a SPARQL alternative property path.
 *
 * Drops empty elements, then brackets and joins several survivors with `|`, returning a single one as is.
 *
 * @param paths - The alternative path elements
 *
 * @returns The bracketed `|`-joined alternative path, the single surviving element, or the empty fragment for none
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#propertypaths SPARQL 1.1 Property Paths}
 */
export function alt(...paths: Mixed<SPARQL>): SPARQL {

	return infix("|", paths.flat());

}

/**
 * Generates a SPARQL inverse property path.
 *
 * @param path - The path element to invert
 *
 * @returns The `^`-prefixed inverse path
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#propertypaths SPARQL 1.1 Property Paths}
 */
export function inv(path: SPARQL): SPARQL {

	return `^${path}`;

}

/**
 * Generates a SPARQL zero-or-more (`*`) property path.
 *
 * @param path - The path element to repeat
 *
 * @returns The `*`-suffixed path
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#propertypaths SPARQL 1.1 Property Paths}
 */
export function star(path: SPARQL): SPARQL {

	return `${path}*`;

}

/**
 * Generates a SPARQL one-or-more (`+`) property path.
 *
 * @param path - The path element to repeat
 *
 * @returns The `+`-suffixed path
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#propertypaths SPARQL 1.1 Property Paths}
 */
export function plus(path: SPARQL): SPARQL {

	return `${path}+`;

}

/**
 * Generates a SPARQL zero-or-one (`?`) property path.
 *
 * @param path - The path element to make optional
 *
 * @returns The `?`-suffixed path
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#propertypaths SPARQL 1.1 Property Paths}
 */
export function opt(path: SPARQL): SPARQL {

	return `${path}?`;

}

/**
 * Generates a SPARQL none property set.
 *
 * Empty predicates are dropped; a single surviving predicate renders as `!p`, while several render as `!(p|q)`.
 *
 * @param predicates - The excluded predicates, each an IRI reference or the {@link inv | inverse} of one
 *
 * @returns The `!`-prefixed none property set
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#propertypaths SPARQL 1.1 Property Paths}
 */
export function none(...predicates: Mixed<SPARQL>): SPARQL {

	return map(predicates.flat().filter(predicate => predicate !== ""), set =>
		set.length === 1 ? `!${set[0]}` : `!(${set.join("|")})`
	);

}


//// Logical Operators (§17.3) /////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL logical negation (`!`).
 *
 * @param condition - The boolean expression to negate
 *
 * @returns The parenthesised `!(…)` negation
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-not SPARQL 1.1 Logical Not}
 */
export function not(condition: SPARQL): SPARQL {

	return `!(${condition})`;

}

/**
 * Generates a SPARQL logical conjunction (`&&`).
 *
 * Drops empty operands, then brackets and joins several survivors with `&&`, returning a single one as is.
 *
 * @param conditions - The boolean expressions to conjoin
 *
 * @returns The bracketed `&&`-joined conjunction, the single surviving operand, or the empty fragment for none
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-logical-and SPARQL 1.1 Logical And}
 */
export function and(...conditions: Mixed<SPARQL>): SPARQL {

	return infix(" && ", conditions.flat());

}

/**
 * Generates a SPARQL logical disjunction (`||`).
 *
 * Drops empty operands, then brackets and joins several survivors with `||`, returning a single one as is.
 *
 * @param conditions - The boolean expressions to disjoin
 *
 * @returns The bracketed `||`-joined disjunction, the single surviving operand, or the empty fragment for none
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-logical-or SPARQL 1.1 Logical Or}
 */
export function or(...conditions: Mixed<SPARQL>): SPARQL {

	return infix(" || ", conditions.flat());

}


//// Comparison Operators (§17.3) //////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL equality (`=`) comparison.
 *
 * @param x - The left operand expression
 * @param y - The right operand expression
 *
 * @returns The `=` comparison expression
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#OperatorMapping SPARQL 1.1 Operator Mapping}
 */
export function eq(x: SPARQL, y: SPARQL): SPARQL {

	return `${x} = ${y}`;

}

/**
 * Generates a SPARQL inequality (`!=`) comparison.
 *
 * @param x - The left operand expression
 * @param y - The right operand expression
 *
 * @returns The `!=` comparison expression
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#OperatorMapping SPARQL 1.1 Operator Mapping}
 */
export function ne(x: SPARQL, y: SPARQL): SPARQL {

	return `${x} != ${y}`;

}

/**
 * Generates a SPARQL greater-than (`>`) comparison.
 *
 * @param x - The left operand expression
 * @param y - The right operand expression
 *
 * @returns The `>` comparison expression
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#OperatorMapping SPARQL 1.1 Operator Mapping}
 */
export function gt(x: SPARQL, y: SPARQL): SPARQL {

	return `${x} > ${y}`;

}

/**
 * Generates a SPARQL less-than (`<`) comparison.
 *
 * @param x - The left operand expression
 * @param y - The right operand expression
 *
 * @returns The `<` comparison expression
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#OperatorMapping SPARQL 1.1 Operator Mapping}
 */
export function lt(x: SPARQL, y: SPARQL): SPARQL {

	return `${x} < ${y}`;

}

/**
 * Generates a SPARQL greater-than-or-equal (`>=`) comparison.
 *
 * @param x - The left operand expression
 * @param y - The right operand expression
 *
 * @returns The `>=` comparison expression
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#OperatorMapping SPARQL 1.1 Operator Mapping}
 */
export function gte(x: SPARQL, y: SPARQL): SPARQL {

	return `${x} >= ${y}`;

}

/**
 * Generates a SPARQL less-than-or-equal (`<=`) comparison.
 *
 * @param x - The left operand expression
 * @param y - The right operand expression
 *
 * @returns The `<=` comparison expression
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#OperatorMapping SPARQL 1.1 Operator Mapping}
 */
export function lte(x: SPARQL, y: SPARQL): SPARQL {

	return `${x} <= ${y}`;

}


//// Arithmetic Operators (§17.3) //////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a parenthesised SPARQL addition (`+`).
 *
 * @param x - The left operand expression
 * @param y - The right operand expression
 *
 * @returns The parenthesised `(… + …)` sum
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#OperatorMapping SPARQL 1.1 Operator Mapping}
 */
export function add(x: SPARQL, y: SPARQL): SPARQL {

	return `(${x} + ${y})`;

}

/**
 * Generates a parenthesised SPARQL subtraction (`-`).
 *
 * @param x - The left operand expression
 * @param y - The right operand expression
 *
 * @returns The parenthesised `(… - …)` difference
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#OperatorMapping SPARQL 1.1 Operator Mapping}
 */
export function sub(x: SPARQL, y: SPARQL): SPARQL {

	return `(${x} - ${y})`;

}

/**
 * Generates a parenthesised SPARQL multiplication (`*`).
 *
 * @param x - The left operand expression
 * @param y - The right operand expression
 *
 * @returns The parenthesised `(… * …)` product
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#OperatorMapping SPARQL 1.1 Operator Mapping}
 */
export function mul(x: SPARQL, y: SPARQL): SPARQL {

	return `(${x} * ${y})`;

}

/**
 * Generates a parenthesised SPARQL division (`/`).
 *
 * @param x - The left operand expression
 * @param y - The right operand expression
 *
 * @returns The parenthesised `(… / …)` quotient
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#OperatorMapping SPARQL 1.1 Operator Mapping}
 */
export function div(x: SPARQL, y: SPARQL): SPARQL {

	return `(${x} / ${y})`;

}

/**
 * Generates a parenthesised SPARQL arithmetic negation (unary `-`).
 *
 * @param x - The operand expression
 *
 * @returns The parenthesised `(-…)` negation
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#OperatorMapping SPARQL 1.1 Operator Mapping}
 */
export function neg(x: SPARQL): SPARQL {

	return `(-${x})`;

}


//// Functional Forms (§17.4.1) ////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL `if()` conditional expression.
 *
 * @param condition - The boolean test expression
 * @param then - The expression for a `true` condition
 * @param otherwise - The expression for a `false` condition
 *
 * @returns The `if(…)` conditional expression
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-if SPARQL 1.1 if}
 */
export function iif(condition: SPARQL, then: SPARQL, otherwise: SPARQL): SPARQL {

	return `if(${condition}, ${then}, ${otherwise})`;

}

/**
 * Generates a SPARQL `coalesce()` call.
 *
 * Empty expressions are dropped before joining.
 *
 * @param expressions - The candidate expressions, in priority order
 *
 * @returns The `coalesce(…)` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-coalesce SPARQL 1.1 coalesce}
 */
export function coalesce(...expressions: Mixed<SPARQL>): SPARQL {

	return `coalesce(${expressions.flat().filter(expression => expression !== "").join(", ")})`;

}

/**
 * Generates a SPARQL `bound()` test.
 *
 * @param expression - The variable to test
 *
 * @returns The `bound()` test
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-bound SPARQL 1.1 bound}
 */
export function isBound(expression: SPARQL): SPARQL {

	return `bound(${expression})`;

}

/**
 * Generates a SPARQL `IN` test.
 *
 * Empty options are dropped; an empty option list renders `in ()` rather than the empty fragment.
 *
 * @param expression - The expression to test
 * @param options - The candidate value expressions
 *
 * @returns The `… in (…)` membership test
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-in SPARQL 1.1 In}
 */
export function isIn(expression: SPARQL, options: readonly SPARQL[]): SPARQL {

	return `${expression} in (${options.filter(option => option !== "").join(", ")})`;

}

/**
 * Generates a SPARQL `NOT IN` test.
 *
 * Empty options are dropped; an empty option list renders `not in ()` rather than the empty fragment.
 *
 * @param expression - The expression to test
 * @param options - The candidate value expressions
 *
 * @returns The `… not in (…)` non-membership test
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-not-in SPARQL 1.1 Not In}
 */
export function isNotIn(expression: SPARQL, options: readonly SPARQL[]): SPARQL {

	return `${expression} not in (${options.filter(option => option !== "").join(", ")})`;

}

/**
 * Generates a SPARQL `exists` test.
 *
 * Empty clauses are dropped; when none survives, the result is the empty fragment.
 *
 * @param patterns - The graph pattern clauses
 *
 * @returns The `exists { … }` test, or the empty fragment for no patterns
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-filter-exists SPARQL 1.1 Filter Exists}
 */
export function exists(...patterns: Mixed<SPARQL>): SPARQL {

	return map(patterns.flat().filter(pattern => pattern !== ""), patterns =>
		patterns.length === 0 ? nil() : `exists { ${fragment(patterns)} }`
	);

}

/**
 * Generates a SPARQL `not exists` test.
 *
 * Empty clauses are dropped; when none survives, the result is the empty fragment.
 *
 * @param patterns - The graph pattern clauses
 *
 * @returns The `not exists { … }` test, or the empty fragment for no patterns
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-filter-exists SPARQL 1.1 Filter Exists}
 */
export function nexists(...patterns: Mixed<SPARQL>): SPARQL {

	return map(patterns.flat().filter(pattern => pattern !== ""), patterns =>
		patterns.length === 0 ? nil() : `not exists { ${fragment(patterns)} }`
	);

}

/**
 * Generates a SPARQL function call.
 *
 * Covers functions without a dedicated builder. Empty arguments are dropped; the name is rendered verbatim.
 *
 * @param fn - The function name
 * @param args - The argument expressions, in order
 *
 * @returns The `fn(…)` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#SparqlOps SPARQL 1.1 Function Library}
 */
export function call(fn: Identifier, ...args: Mixed<SPARQL>): SPARQL {

	return `${fn}(${args.flat().filter(arg => arg !== "").join(", ")})`;

}


//// RDF Term Functions (§17.4.2) //////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL `str()` call.
 *
 * @param expression - The term expression
 *
 * @returns The `str()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-str SPARQL 1.1 str}
 */
export function str(expression: SPARQL): SPARQL {

	return `str(${expression})`;

}

/**
 * Generates a SPARQL `lang()` call.
 *
 * @param expression - The literal expression
 *
 * @returns The `lang()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-lang SPARQL 1.1 lang}
 */
export function lang(expression: SPARQL): SPARQL {

	return `lang(${expression})`;

}

/**
 * Generates a SPARQL `datatype()` call.
 *
 * @param expression - The literal expression
 *
 * @returns The `datatype()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-datatype SPARQL 1.1 datatype}
 */
export function datatype(expression: SPARQL): SPARQL {

	return `datatype(${expression})`;

}

/**
 * Generates a SPARQL `isblank()` test.
 *
 * @param expression - The term expression
 *
 * @returns The `isblank()` test
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-isBlank SPARQL 1.1 isBlank}
 */
export function isBlank(expression: SPARQL): SPARQL {

	return `isblank(${expression})`;

}

/**
 * Generates a SPARQL `isiri()` test.
 *
 * @param expression - The term expression
 *
 * @returns The `isiri()` test
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-isIRI SPARQL 1.1 isIRI}
 */
export function isIRI(expression: SPARQL): SPARQL {

	return `isiri(${expression})`;

}

/**
 * Generates a SPARQL `isliteral()` test.
 *
 * @param expression - The term expression
 *
 * @returns The `isliteral()` test
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-isLiteral SPARQL 1.1 isLiteral}
 */
export function isLiteral(expression: SPARQL): SPARQL {

	return `isliteral(${expression})`;

}

/**
 * Generates a SPARQL `isnumeric()` test.
 *
 * @param expression - The term expression
 *
 * @returns The `isnumeric()` test
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-isNumeric SPARQL 1.1 isNumeric}
 */
export function isNumeric(expression: SPARQL): SPARQL {

	return `isnumeric(${expression})`;

}

/**
 * Generates a SPARQL `sameterm()` test.
 *
 * @param x - The left term expression
 * @param y - The right term expression
 *
 * @returns The `sameterm()` test
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-sameTerm SPARQL 1.1 sameTerm}
 */
export function sameTerm(x: SPARQL, y: SPARQL): SPARQL {

	return `sameterm(${x}, ${y})`;

}

/**
 * Generates a SPARQL `iri()` call.
 *
 * @param expression - The string or IRI expression
 *
 * @returns The `iri()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-iri SPARQL 1.1 IRI}
 */
export function iri(expression: SPARQL): SPARQL {

	return `iri(${expression})`;

}

/**
 * Generates a SPARQL `bnode()` call.
 *
 * @param expression - The correlating expression, or omitted
 *
 * @returns The `bnode()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-bnode SPARQL 1.1 BNODE}
 */
export function bnode(expression?: SPARQL): SPARQL {

	return expression === undefined ? "bnode()" : `bnode(${expression})`;

}

/**
 * Generates a SPARQL `strdt()` call.
 *
 * @param expression - The lexical form expression
 * @param datatype - The datatype IRI expression
 *
 * @returns The `strdt()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-strdt SPARQL 1.1 STRDT}
 */
export function strdt(expression: SPARQL, datatype: SPARQL): SPARQL {

	return `strdt(${expression}, ${datatype})`;

}

/**
 * Generates a SPARQL `strlang()` call.
 *
 * @param expression - The lexical form expression
 * @param language - The language tag expression
 *
 * @returns The `strlang()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-strlang SPARQL 1.1 STRLANG}
 */
export function strlang(expression: SPARQL, language: SPARQL): SPARQL {

	return `strlang(${expression}, ${language})`;

}

/**
 * Generates a SPARQL `uuid()` call.
 *
 * @returns The `uuid()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-uuid SPARQL 1.1 UUID}
 */
export function uuid(): SPARQL {

	return "uuid()";

}

/**
 * Generates a SPARQL `struuid()` call.
 *
 * @returns The `struuid()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-struuid SPARQL 1.1 STRUUID}
 */
export function struuid(): SPARQL {

	return "struuid()";

}


//// String Functions (§17.4.3) ////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL `strlen()` call.
 *
 * @param expression - The string expression
 *
 * @returns The `strlen()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-strlen SPARQL 1.1 STRLEN}
 */
export function strlen(expression: SPARQL): SPARQL {

	return `strlen(${expression})`;

}

/**
 * Generates a SPARQL `substr()` call.
 *
 * @param source - The string expression
 * @param starting - The 1-based start position expression
 * @param length - The length expression, or omitted
 *
 * @returns The `substr()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-substr SPARQL 1.1 SUBSTR}
 */
export function substr(source: SPARQL, starting: SPARQL, length?: SPARQL): SPARQL {

	return length === undefined ? `substr(${source}, ${starting})` : `substr(${source}, ${starting}, ${length})`;

}

/**
 * Generates a SPARQL `ucase()` call.
 *
 * @param expression - The string expression
 *
 * @returns The `ucase()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-ucase SPARQL 1.1 UCASE}
 */
export function ucase(expression: SPARQL): SPARQL {

	return `ucase(${expression})`;

}

/**
 * Generates a SPARQL `lcase()` call.
 *
 * @param expression - The string expression
 *
 * @returns The `lcase()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-lcase SPARQL 1.1 LCASE}
 */
export function lcase(expression: SPARQL): SPARQL {

	return `lcase(${expression})`;

}

/**
 * Generates a SPARQL `strstarts()` call.
 *
 * @param source - The string expression
 * @param prefix - The prefix expression
 *
 * @returns The `strstarts()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-strstarts SPARQL 1.1 STRSTARTS}
 */
export function strstarts(source: SPARQL, prefix: SPARQL): SPARQL {

	return `strstarts(${source}, ${prefix})`;

}

/**
 * Generates a SPARQL `strends()` call.
 *
 * @param source - The string expression
 * @param suffix - The suffix expression
 *
 * @returns The `strends()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-strends SPARQL 1.1 STRENDS}
 */
export function strends(source: SPARQL, suffix: SPARQL): SPARQL {

	return `strends(${source}, ${suffix})`;

}

/**
 * Generates a SPARQL `contains()` call.
 *
 * @param source - The string expression
 * @param substring - The substring expression
 *
 * @returns The `contains()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-contains SPARQL 1.1 CONTAINS}
 */
export function contains(source: SPARQL, substring: SPARQL): SPARQL {

	return `contains(${source}, ${substring})`;

}

/**
 * Generates a SPARQL `strbefore()` call.
 *
 * @param source - The string expression
 * @param substring - The substring expression
 *
 * @returns The `strbefore()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-strbefore SPARQL 1.1 STRBEFORE}
 */
export function strbefore(source: SPARQL, substring: SPARQL): SPARQL {

	return `strbefore(${source}, ${substring})`;

}

/**
 * Generates a SPARQL `strafter()` call.
 *
 * @param source - The string expression
 * @param substring - The substring expression
 *
 * @returns The `strafter()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-strafter SPARQL 1.1 STRAFTER}
 */
export function strafter(source: SPARQL, substring: SPARQL): SPARQL {

	return `strafter(${source}, ${substring})`;

}

/**
 * Generates a SPARQL `encode_for_uri()` call.
 *
 * @param expression - The string expression
 *
 * @returns The `encode_for_uri()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-encode SPARQL 1.1 ENCODE_FOR_URI}
 */
export function encodeForUri(expression: SPARQL): SPARQL {

	return `encode_for_uri(${expression})`;

}

/**
 * Generates a SPARQL `concat()` call.
 *
 * Empty expressions are dropped before joining.
 *
 * @param expressions - The string expressions
 *
 * @returns The `concat()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-concat SPARQL 1.1 CONCAT}
 */
export function concat(...expressions: Mixed<SPARQL>): SPARQL {

	return `concat(${expressions.flat().filter(expression => expression !== "").join(", ")})`;

}

/**
 * Generates a SPARQL `langmatches()` call.
 *
 * The `range` is rendered as a {@link string} literal.
 *
 * @param expression - The language tag expression, typically a {@link lang} call
 * @param range - The basic RFC 4647 language range
 *
 * @returns The `langmatches()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-langMatches SPARQL 1.1 langMatches}
 */
export function langMatches(expression: SPARQL, range: TagRange): SPARQL {

	return `langmatches(${expression}, ${string(range)})`;

}

/**
 * Generates a SPARQL `regex()` call.
 *
 * @param text - The string expression
 * @param pattern - The pattern expression
 * @param flags - The flags expression, or omitted
 *
 * @returns The `regex()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-regex SPARQL 1.1 REGEX}
 */
export function regex(text: SPARQL, pattern: SPARQL, flags?: SPARQL): SPARQL {

	return flags === undefined ? `regex(${text}, ${pattern})` : `regex(${text}, ${pattern}, ${flags})`;

}

/**
 * Generates a SPARQL `replace()` call.
 *
 * @param text - The string expression
 * @param pattern - The pattern expression
 * @param replacement - The replacement expression
 * @param flags - The flags expression, or omitted
 *
 * @returns The `replace()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-replace SPARQL 1.1 REPLACE}
 */
export function replace(text: SPARQL, pattern: SPARQL, replacement: SPARQL, flags?: SPARQL): SPARQL {

	return flags === undefined
		? `replace(${text}, ${pattern}, ${replacement})`
		: `replace(${text}, ${pattern}, ${replacement}, ${flags})`;

}


//// Numeric Functions (§17.4.4) ///////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL `abs()` call.
 *
 * @param expression - The numeric expression
 *
 * @returns The `abs()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-abs SPARQL 1.1 abs}
 */
export function abs(expression: SPARQL): SPARQL {

	return `abs(${expression})`;

}

/**
 * Generates a SPARQL `round()` call.
 *
 * @param expression - The numeric expression
 *
 * @returns The `round()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-round SPARQL 1.1 round}
 */
export function round(expression: SPARQL): SPARQL {

	return `round(${expression})`;

}

/**
 * Generates a SPARQL `ceil()` call.
 *
 * @param expression - The numeric expression
 *
 * @returns The `ceil()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-ceil SPARQL 1.1 ceil}
 */
export function ceil(expression: SPARQL): SPARQL {

	return `ceil(${expression})`;

}

/**
 * Generates a SPARQL `floor()` call.
 *
 * @param expression - The numeric expression
 *
 * @returns The `floor()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-floor SPARQL 1.1 floor}
 */
export function floor(expression: SPARQL): SPARQL {

	return `floor(${expression})`;

}

/**
 * Generates a SPARQL `rand()` call.
 *
 * @returns The `rand()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-rand SPARQL 1.1 RAND}
 */
export function rand(): SPARQL {

	return "rand()";

}


//// Temporal Functions (§17.4.5) //////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL `now()` call.
 *
 * @returns The `now()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-now SPARQL 1.1 now}
 */
export function now(): SPARQL {

	return "now()";

}

/**
 * Generates a SPARQL `year()` call.
 *
 * @param expression - The `xsd:dateTime` expression
 *
 * @returns The `year()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-year SPARQL 1.1 year}
 */
export function year(expression: SPARQL): SPARQL {

	return `year(${expression})`;

}

/**
 * Generates a SPARQL `month()` call.
 *
 * @param expression - The `xsd:dateTime` expression
 *
 * @returns The `month()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-month SPARQL 1.1 month}
 */
export function month(expression: SPARQL): SPARQL {

	return `month(${expression})`;

}

/**
 * Generates a SPARQL `day()` call.
 *
 * @param expression - The `xsd:dateTime` expression
 *
 * @returns The `day()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-day SPARQL 1.1 day}
 */
export function day(expression: SPARQL): SPARQL {

	return `day(${expression})`;

}

/**
 * Generates a SPARQL `hours()` call.
 *
 * @param expression - The `xsd:dateTime` expression
 *
 * @returns The `hours()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-hours SPARQL 1.1 hours}
 */
export function hours(expression: SPARQL): SPARQL {

	return `hours(${expression})`;

}

/**
 * Generates a SPARQL `minutes()` call.
 *
 * @param expression - The `xsd:dateTime` expression
 *
 * @returns The `minutes()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-minutes SPARQL 1.1 minutes}
 */
export function minutes(expression: SPARQL): SPARQL {

	return `minutes(${expression})`;

}

/**
 * Generates a SPARQL `seconds()` call.
 *
 * @param expression - The `xsd:dateTime` expression
 *
 * @returns The `seconds()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-seconds SPARQL 1.1 seconds}
 */
export function seconds(expression: SPARQL): SPARQL {

	return `seconds(${expression})`;

}

/**
 * Generates a SPARQL `timezone()` call.
 *
 * @param expression - The `xsd:dateTime` expression
 *
 * @returns The `timezone()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-timezone SPARQL 1.1 timezone}
 */
export function timezone(expression: SPARQL): SPARQL {

	return `timezone(${expression})`;

}

/**
 * Generates a SPARQL `tz()` call.
 *
 * @param expression - The `xsd:dateTime` expression
 *
 * @returns The `tz()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-tz SPARQL 1.1 tz}
 */
export function tz(expression: SPARQL): SPARQL {

	return `tz(${expression})`;

}


//// Hash Functions (§17.4.6) //////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL `md5()` call.
 *
 * @param expression - The string expression
 *
 * @returns The `md5()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-md5 SPARQL 1.1 MD5}
 */
export function md5(expression: SPARQL): SPARQL {

	return `md5(${expression})`;

}

/**
 * Generates a SPARQL `sha1()` call.
 *
 * @param expression - The string expression
 *
 * @returns The `sha1()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-sha1 SPARQL 1.1 SHA1}
 */
export function sha1(expression: SPARQL): SPARQL {

	return `sha1(${expression})`;

}

/**
 * Generates a SPARQL `sha256()` call.
 *
 * @param expression - The string expression
 *
 * @returns The `sha256()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-sha256 SPARQL 1.1 SHA256}
 */
export function sha256(expression: SPARQL): SPARQL {

	return `sha256(${expression})`;

}

/**
 * Generates a SPARQL `sha384()` call.
 *
 * @param expression - The string expression
 *
 * @returns The `sha384()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-sha384 SPARQL 1.1 SHA384}
 */
export function sha384(expression: SPARQL): SPARQL {

	return `sha384(${expression})`;

}

/**
 * Generates a SPARQL `sha512()` call.
 *
 * @param expression - The string expression
 *
 * @returns The `sha512()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-sha512 SPARQL 1.1 SHA512}
 */
export function sha512(expression: SPARQL): SPARQL {

	return `sha512(${expression})`;

}


//// Aggregates (§18.5.1) //////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL `count()` aggregate.
 *
 * Omitting `expression` renders `count(*)`; a {@link distinct} argument renders `count(distinct …)`.
 *
 * @param expression - The aggregated expression, or omitted
 *
 * @returns The `count(…)` aggregate
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#defn_aggCount SPARQL 1.1 Count}
 */
export function count(expression?: SPARQL): SPARQL {

	return `count(${expression ?? "*"})`;

}

/**
 * Generates a SPARQL `sum()` aggregate.
 *
 * @param expression - The aggregated expression
 *
 * @returns The `sum(…)` aggregate
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#defn_aggSum SPARQL 1.1 Sum}
 */
export function sum(expression: SPARQL): SPARQL {

	return `sum(${expression})`;

}

/**
 * Generates a SPARQL `min()` aggregate.
 *
 * @param expression - The aggregated expression
 *
 * @returns The `min(…)` aggregate
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#defn_aggMin SPARQL 1.1 Min}
 */
export function min(expression: SPARQL): SPARQL {

	return `min(${expression})`;

}

/**
 * Generates a SPARQL `max()` aggregate.
 *
 * @param expression - The aggregated expression
 *
 * @returns The `max(…)` aggregate
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#defn_aggMax SPARQL 1.1 Max}
 */
export function max(expression: SPARQL): SPARQL {

	return `max(${expression})`;

}

/**
 * Generates a SPARQL `avg()` aggregate.
 *
 * @param expression - The aggregated expression
 *
 * @returns The `avg(…)` aggregate
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#defn_aggAvg SPARQL 1.1 Avg}
 */
export function avg(expression: SPARQL): SPARQL {

	return `avg(${expression})`;

}

/**
 * Generates a SPARQL `sample()` aggregate.
 *
 * @param expression - The aggregated expression
 *
 * @returns The `sample(…)` aggregate
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#defn_aggSample SPARQL 1.1 Sample}
 */
export function sample(expression: SPARQL): SPARQL {

	return `sample(${expression})`;

}

/**
 * Generates a SPARQL `group_concat()` aggregate.
 *
 * The `separator` is rendered as a {@link string} literal in the `separator=` argument.
 *
 * @param expression - The aggregated expression
 * @param separator - The separator, or omitted
 *
 * @returns The `group_concat(…)` aggregate
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#defn_aggGroupConcat SPARQL 1.1 GroupConcat}
 */
export function groupConcat(expression: SPARQL, separator?: string): SPARQL {

	return separator === undefined
		? `group_concat(${expression})`
		: `group_concat(${expression}; separator=${string(separator)})`;

}


//// Serialisers (§4) //////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates SPARQL triple patterns from a {@link Pattern} sequence.
 *
 * Space-joins the patterns rendered via {@link pattern}, so the empty sequence yields the empty string.
 *
 * @param patterns - The triple patterns to serialise
 *
 * @returns The generated triple patterns, space-joined, or the empty string for an empty sequence
 *
 * @throws RangeError if any pattern carries a malformed IRI, lexical form, or language tag
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#QSynTriples SPARQL 1.1 Triple Patterns}
 */
export function patterns(patterns: readonly Pattern[]): SPARQL {

	return patterns.map(pattern).join(" ");

}

/**
 * Generates a SPARQL triple pattern.
 *
 * Dispatches each position of the {@link Pattern} to the matching serialiser: a {@link Variable} renders as itself via
 * {@link variable}; a non-variable subject renders as a {@link blank | blank node} or an IRI {@link reference}; a
 * non-variable object renders as any {@link term}. A non-variable predicate renders as an IRI {@link reference},
 * except for the `type` IRI of the {@link rdf} vocabulary namespace, which is abbreviated to the SPARQL `a`
 * {@link https://www.w3.org/TR/sparql11-query/#abbrevRdfType shorthand}.
 *
 * @param pattern - The triple pattern to serialise, as a `[subject, predicate, object]` tuple
 *
 * @returns The generated triple pattern
 *
 * @throws RangeError if `pattern` carries a malformed IRI, lexical form, or language tag
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#QSynTriples SPARQL 1.1 Triple Patterns}
 */
export function pattern([subject, predicate, object]: Pattern): SPARQL {

	return edge(
		isString(subject) ? variable(subject) : term(subject),
		isString(predicate) ? variable(predicate) : predicate.iri === rdf.type ? "a" : reference(predicate.iri),
		isString(object) ? variable(object) : term(object)
	);

}


/**
 * Generates SPARQL triple data from a {@link Triple} sequence.
 *
 * Space-joins the triples rendered via {@link triple}, so the empty sequence yields the empty string.
 *
 * @param triples - The triples to serialise
 *
 * @returns The generated triple data, space-joined, or the empty string for an empty sequence
 *
 * @throws RangeError if any triple carries a malformed IRI, lexical form, or language tag
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#QSynTriples SPARQL 1.1 Triple Patterns}
 */
export function triples(triples: readonly Triple[]): SPARQL {

	return triples.map(triple).join(" ");

}

/**
 * Generates the SPARQL representation of a single {@link Triple}.
 *
 * Renders the triple as `subject predicate object .`, with the subject and object rendered via {@link term}. The
 * predicate renders as an IRI {@link reference}, except for the `type` IRI of the {@link rdf} vocabulary namespace,
 * which is abbreviated to the SPARQL `a` {@link https://www.w3.org/TR/sparql11-query/#abbrevRdfType shorthand}.
 *
 * @param triple - The triple to serialise, as a `[subject, predicate, object]` tuple
 *
 * @returns The generated triple
 *
 * @throws RangeError if `triple` carries a malformed IRI, lexical form, or language tag
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#QSynTriples SPARQL 1.1 Triple Patterns}
 */
export function triple([subject, predicate, object]: Triple): SPARQL {

	return edge(
		term(subject),
		predicate.iri === rdf.type ? "a" : reference(predicate.iri),
		term(object)
	);

}


/**
 * Generates the SPARQL representation of a {@link Variable} or {@link Term}.
 *
 * Dispatches to {@link variable} for a query variable and to {@link term} for an RDF term.
 *
 * @param anchor - The query variable or RDF term to render
 *
 * @returns The generated SPARQL node
 *
 * @throws RangeError if `anchor` is a term carrying a malformed IRI, lexical form, or language tag
 */
export function anchor(anchor: Variable | Term): SPARQL {

	return isString(anchor) ? variable(anchor) : term(anchor);

}

/**
 * Generates the SPARQL representation of a {@link Variable}.
 *
 * The variable token is already its own SPARQL form (for example `?0`), so it is emitted verbatim.
 *
 * @param variable - The variable token
 *
 * @returns The SPARQL variable
 */
export function variable(variable: Variable): SPARQL {

	return variable;

}

/**
 * Generates the SPARQL representation of a {@link Term}.
 *
 * Dispatches on the term's `kind`: {@link blank} for a blank node's label, {@link reference} for a named resource's
 * IRI, {@link tagged} for language-tagged literals and {@link typed} for datatype-typed ones, collapsing a literal
 * carrying the redundant `xsd:string` datatype to the bare quoted form.
 *
 * @param term - The RDF term to render
 *
 * @returns The generated SPARQL term
 *
 * @throws RangeError if `term` carries a malformed IRI, lexical form, or language tag
 *
 * @remarks
 *
 * Renders SPARQL query text and is distinct from the same-named `term` encoder of
 * {@link https://metreeca.github.io/trio/ @metreeca/trio}, which mints RDF {@link Term} values. The companion
 * serialisers {@link blank}, {@link tagged} and {@link typed} shadow that package's same-named value constructors the
 * same way, as does {@link reference} for its `named` one.
 */
export function term(term: Term): SPARQL {

	return term.kind === "blank" ? blank(term.label)
		: term.kind === "named" ? reference(term.iri)
			: term.kind === "tagged" ? tagged(term.text, term.language)
				: typed(term.text, term.datatype);

}


/**
 * Generates the SPARQL representation of a blank node.
 *
 * Renders the supplied label into a `_:`-prefixed token. With no argument, mints a fresh token with a random label;
 * supply a label only where blank-node identity must be correlated across the fragment.
 *
 * > [!WARNING]
 * > The label is rendered as supplied: `BLANK_NODE_LABEL` defines no escape mechanism and the label is not checked
 * > against the production, so a malformed label breaks the fragment carrying it. Callers relaying labels from
 * > external sources are responsible for vetting them.
 *
 * @param label - The blank-node label: a non-negative integer, or a string matching the `BLANK_NODE_LABEL` body;
 * 		omitted to mint a fresh anonymous node
 *
 * @returns The generated blank node
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#QSynBlankNodes SPARQL 1.1 Blank Nodes}
 * @see {@link https://www.w3.org/TR/sparql11-query/#rBLANK_NODE_LABEL SPARQL 1.1 §19.8 — BLANK_NODE_LABEL}
 */
export function blank(label?: number | string): SPARQL {

	return `_:${label ?? crypto.randomUUID().replaceAll("-", "")}`;

}

/**
 * Generates the SPARQL IRIREF for an {@link IRI}.
 *
 * Escapes supplementary code points as UCHAR sequences. With no argument, mints a fresh `urn:uuid:` IRI.
 *
 * The IRI is validated as an RFC 3987 reference, absolute or relative, and never resolved: a relative IRI is accepted
 * and rendered as supplied, unlike the `named` term constructor of
 * {@link https://metreeca.github.io/trio/ @metreeca/trio}, which admits only absolute ones.
 *
 * @param iri - The IRI to render, or omitted to mint a fresh `urn:uuid:` IRI
 *
 * @returns The generated IRIREF
 *
 * @throws RangeError if `iri` is not a well-formed RFC 3987 reference, an isolated UTF-16 surrogate code point
 * 		included
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#rIRIREF SPARQL 1.1 IRIREF}
 */
export function reference(iri?: IRI): SPARQL {

	return iri === undefined ? `<urn:uuid:${crypto.randomUUID()}>`
		: isReference(iri) ? `<${escapeIRI(iri)}>`
			: error(new RangeError(`malformed IRI reference <${iri}>`));

}

/**
 * Generates the SPARQL representation of a boolean value.
 *
 * @param value - The boolean value to render
 *
 * @returns The generated boolean literal, either `true` or `false`
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#QSynLiterals SPARQL 1.1 RDF Term Syntax}
 */
export function boolean(value: boolean): SPARQL {

	return value ? "true" : "false";

}

/**
 * Generates the SPARQL representation of a numeric value.
 *
 * Emits a bare numeric literal, the most compact typed form: an integer renders as an `xsd:integer` (for example
 * `42`), a finite non-integer as an `xsd:decimal` where representable without an exponent (for example `4.2`) and as
 * an `xsd:double` otherwise (for example `1e-7`). A non-finite value has no native SPARQL syntax and renders as an
 * explicitly typed `xsd:double` literal, using the lexical forms `INF`, `-INF` and `NaN`.
 *
 * @param value - The numeric value to render
 *
 * @returns The generated numeric literal
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#QSynLiterals SPARQL 1.1 RDF Term Syntax}
 */
export function number(value: number): SPARQL {

	return Number.isFinite(value)
		? String(value)
		: `"${Number.isNaN(value) ? "NaN" : value > 0 ? "INF" : "-INF"}"^^${reference(xsd.double)}`;

}

/**
 * Generates the SPARQL representation of a string value.
 *
 * Emits a double-quoted simple literal, escaping the content according to the STRING_LITERAL2 production.
 *
 * @param value - The string value to render
 *
 * @returns The generated simple literal
 *
 * @throws RangeError if `value` is not a well-formed Unicode string, that is if it holds an isolated UTF-16 surrogate
 * 		code point
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#rSTRING_LITERAL2 SPARQL 1.1 STRING_LITERAL2}
 */
export function string(value: string): SPARQL {

	return isWellFormed(value)
		? `"${escapeString(value)}"`
		: error(new RangeError(`malformed lexical form <${value}>`));

}

/**
 * Generates a language-tagged RDF literal.
 *
 * Emits the form `"text"@language`, escaping `text` according to the STRING_LITERAL2 production. The tag is validated
 * rather than escaped: `LANGTAG` admits no escape mechanism, so an unchecked tag carrying grammar delimiters would
 * break out of the literal into the surrounding fragment.
 *
 * @param text - The lexical value of the literal
 * @param language - The BCP 47 language tag
 *
 * @returns The generated language-tagged literal
 *
 * @throws RangeError if `text` is not a well-formed Unicode string, that is if it holds an isolated UTF-16 surrogate
 * 		code point, or if `language` is not a well-formed BCP 47 language tag
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#rRDFLiteral SPARQL 1.1 RDFLiteral}
 * @see {@link https://www.w3.org/TR/sparql11-query/#rLANGTAG SPARQL 1.1 §19.8 — LANGTAG}
 */
export function tagged(text: string, language: Tag): SPARQL {

	return !isTag(language)
		? error(new RangeError(`malformed language tag <${language}>`))
		: `${string(text)}@${language}`;

}

/**
 * Generates a datatype-annotated RDF literal.
 *
 * Emits the form `"text"^^<datatype>`, escaping `text` according to the STRING_LITERAL2 production and the datatype
 * according to the IRIREF production; a missing or `xsd:string` datatype collapses to the {@link string} form.
 *
 * @param text - The lexical value of the literal
 * @param datatype - The IRI identifying the literal's datatype, or omitted for a plain `xsd:string` literal
 *
 * @returns The generated literal, datatype-annotated unless the datatype is omitted or `xsd:string`
 *
 * @throws RangeError if `text` is not a well-formed Unicode string, or if `datatype` is not a well-formed RFC 3987
 * 		reference, an isolated UTF-16 surrogate code point included
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#rRDFLiteral SPARQL 1.1 RDFLiteral}
 */
export function typed(text: string, datatype?: IRI): SPARQL {

	return datatype === undefined || datatype === xsd.string
		? string(text)
		: `${string(text)}^^${reference(datatype)}`;

}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Joins the non-empty operands of an n-ary `operator`.
 *
 * Brackets the result when several operands survive, so it binds as a whole wherever it is nested.
 */
function infix(operator: string, operands: readonly SPARQL[]): SPARQL {

	return map(operands.filter(operand => operand !== ""), operands =>
		operands.length === 0 ? nil()
			: operands.length === 1 ? operands[0]
				: `(${operands.join(operator)})`
	);

}

/**
 * Renders the graphs a {@link clear} or {@link drop} operation targets.
 *
 * Emits the keywords `default`, `named` and `all` as they are, and any other target as a `graph`-prefixed IRIREF.
 */
function scope(target: "default" | "named" | "all" | IRI): SPARQL {

	return target === "default" || target === "named" || target === "all"
		? target
		: `graph ${reference(target)}`;

}

/**
 * Renders a graph a {@link copy}, {@link move} or {@link aad} operation reads from or writes to.
 *
 * Emits the `default` keyword as it is, and any other graph as a `graph`-prefixed IRIREF.
 */
function origin(graph: "default" | IRI): SPARQL {

	return graph === "default" ? graph : `graph ${reference(graph)}`;

}

/**
 * Escapes an IRI for inclusion between the angle brackets of an IRIREF.
 *
 * Emits an eight-digit `\UXXXXXXXX` UCHAR escape for every character {@link IRIEscapePattern} selects, leaving
 * everything else as it is, the non-ASCII BMP characters the production admits directly included. Every escape is
 * numeric, `UCHAR` being the only escape `IRIREF` admits, so the two-character shorthands are overridden with an
 * empty table.
 */
function escapeIRI(iri: IRI): string {

	return escape(iri, IRIEscapePattern, {});

}

/**
 * Escapes a lexical form for inclusion between the double quotes of a STRING_LITERAL2.
 *
 * Replaces backslash, double-quote and the C0 control characters with the two-character escapes `ECHAR` shares with
 * JSON, and every remaining control character with its four-digit `\uXXXX` sequence, which SPARQL resolves into a code
 * point `STRING_LITERAL2` then admits verbatim. Supplementary code points are left as they are, the production
 * admitting them directly.
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#rECHAR SPARQL 1.1 §19.8 — ECHAR}
 */
function escapeString(text: string): string {

	return escape(text);

}
