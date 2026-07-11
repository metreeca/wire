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
 * DSL for SPARQL queries and updates.
 *
 * Provides composable combinators that assemble SPARQL request strings from typed fragments: update operations, graph
 * patterns, property paths, expressions, aggregates, solution modifiers, and the serialisers that render RDF
 * {@link Term | terms} into their SPARQL lexical forms. Every combinator takes and returns {@link SPARQL} fragments, so
 * clauses nest by ordinary function composition into a complete query or update.
 *
 * @module
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/ SPARQL 1.1 Query Language}
 * @see {@link https://www.w3.org/TR/sparql11-update/ SPARQL 1.1 Update}
 * @see {@link https://www.w3.org/TR/rdf11-concepts/ RDF 1.1 Concepts}
 * @see {@link https://www.w3.org/TR/n-triples/ RDF 1.1 N-Triples}
 */

import { type Identifier, isString } from "@metreeca/core";
import { map } from "@metreeca/core/combo";
import { xsd } from "@metreeca/core/datatype";
import { isTag, type Tag, type TagRange } from "@metreeca/core/language";
import { escapeIRI, escapeString } from "./dsl.core.js";
import {
	type Blank,
	isBlank as isBlankValue,
	isReference,
	isTagged,
	isVariable,
	type Pattern,
	type Reference,
	type SPARQL,
	type Term,
	type Triple,
	type Variable
} from "./index.js";


/**
 * The full `rdf:type` predicate IRI, expanded from the SPARQL `"a"` shorthand.
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#abbrevRdfType SPARQL `rdf:type` shorthand}
 */
const type: Reference = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";


//// Updates (Update §3) ///////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Combines SPARQL update operations into a single request.
 *
 * Joins the operations with `;`, the separator that sequences multiple operations in one request; they are applied in
 * order against the graph store, as produced by {@link insert} and {@link deleet}. Empty operations, such as those
 * produced by {@link nil}, are dropped before joining, so optional operations left out do not introduce redundant
 * separators.
 *
 * @param updates The update operations to sequence
 *
 * @returns The `;`-separated SPARQL update request, excluding empty operations
 *
 * @see {@link https://www.w3.org/TR/sparql11-update/ SPARQL 1.1 Update}
 */
export function update(...updates: readonly SPARQL[]): SPARQL {
	return updates.filter(operation => operation !== "").join("; ");
}

/**
 * Generates a SPARQL `DELETE` update removing triples from the graph store.
 *
 * Without a `where` argument, produces a ground `delete data` operation removing the `content` triples verbatim. With a
 * `where` argument, produces a `delete … where` operation removing, for each solution of the pattern, the triples the
 * `content` template instantiates. Pass `content` as a single serialised block or a list of clauses joined into a
 * fragment.
 *
 * @param content The triples to remove: ground triples for `delete data`, or a triple template for `delete … where`
 * @param where The optional {@link where} clause selecting solutions to instantiate against; omit for a ground form
 *
 * @returns The SPARQL `DELETE` update
 *
 * @see {@link https://www.w3.org/TR/sparql11-update/#deleteData SPARQL 1.1 Update — Delete Data}
 * @see {@link https://www.w3.org/TR/sparql11-update/#deleteInsert SPARQL 1.1 Update — Delete/Insert}
 */
export function deleet(content: SPARQL | readonly SPARQL[], where?: SPARQL): SPARQL {
	return where === undefined
		? `delete data { ${isString(content) ? content : fragment(...content)} }`
		: `delete { ${isString(content) ? content : fragment(...content)} } ${where}`;
}

/**
 * Generates a SPARQL `INSERT` update adding triples to the graph store.
 *
 * Without a `where` argument, produces a ground `insert data` operation adding the `content` triples verbatim. With a
 * `where` argument, produces an `insert … where` operation adding, for each solution of the pattern, the triples the
 * `content` template instantiates. Pass `content` as a single serialised block or a list of clauses joined into a
 * fragment.
 *
 * @param content The triples to add: ground triples for `insert data`, or a triple template for `insert … where`
 * @param where The optional {@link where} clause selecting solutions to instantiate against; omit for a ground form
 *
 * @returns The SPARQL `INSERT` update
 *
 * @see {@link https://www.w3.org/TR/sparql11-update/#insertData SPARQL 1.1 Update — Insert Data}
 * @see {@link https://www.w3.org/TR/sparql11-update/#deleteInsert SPARQL 1.1 Update — Delete/Insert}
 */
export function insert(content: SPARQL | readonly SPARQL[], where?: SPARQL): SPARQL {
	return where === undefined
		? `insert data { ${isString(content) ? content : fragment(...content)} }`
		: `insert { ${isString(content) ? content : fragment(...content)} } ${where}`;
}


//// Queries (§16) /////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL `ASK` query.
 *
 * Prefixes the space-joined clauses with `ask`, producing a query that tests whether the graph pattern has any solution
 * and returns a boolean. Supply the pattern as a {@link where} clause.
 *
 * @param clauses The query clauses, typically a {@link where} clause
 *
 * @returns The SPARQL `ASK` query
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#ask SPARQL 1.1 ASK}
 */
export function ask(...clauses: readonly SPARQL[]): SPARQL {
	return `ask ${fragment(...clauses)}`;
}

/**
 * Generates a SPARQL `SELECT` query.
 *
 * Prefixes the projection with `select`, followed by the space-joined clauses. The projection is either a single
 * expression, such as the {@link all} wildcard, or a list of projection variables and {@link as} aliases joined into a
 * fragment. Supply the graph pattern and solution modifiers as the trailing clauses.
 *
 * @param projection The result projection: a single expression, or a list of projection variables and aliases
 * @param clauses The query clauses, typically a {@link where} clause followed by solution modifiers
 *
 * @returns The SPARQL `SELECT` query
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#select SPARQL 1.1 SELECT}
 */
export function select(projection: SPARQL | readonly SPARQL[], ...clauses: readonly SPARQL[]): SPARQL {
	return `select ${isString(projection) ? projection : fragment(...projection)} ${fragment(...clauses)}`;
}

/**
 * Generates a SPARQL `distinct` modifier over a projection or aggregate argument.
 *
 * Prefixes the space-joined expressions with `distinct`, eliminating duplicate solutions in a `select` projection or
 * deduplicating an aggregate's input, as in {@link count}. An empty list yields the bare `distinct` keyword.
 *
 * @param expressions The projection variables or aggregate argument to deduplicate
 *
 * @returns The `distinct` modifier
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#modDuplicates SPARQL 1.1 Duplicate Solutions}
 */
export function distinct(...expressions: readonly SPARQL[]): SPARQL {
	return expressions.length === 0 ? "distinct" : `distinct ${fragment(...expressions)}`;
}

/**
 * Generates a SPARQL `reduced` modifier over a projection.
 *
 * Prefixes the space-joined projection with `reduced`, permitting but not requiring duplicate elimination, a cheaper
 * alternative to {@link distinct}. An empty list yields the bare `reduced` keyword.
 *
 * @param expressions The projection variables to permit deduplicating
 *
 * @returns The `reduced` modifier
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#modReduced SPARQL 1.1 Reduced Solutions}
 */
export function reduced(...expressions: readonly SPARQL[]): SPARQL {
	return expressions.length === 0 ? "reduced" : `reduced ${fragment(...expressions)}`;
}

/**
 * Generates the SPARQL `*` projection wildcard.
 *
 * @returns The `*` wildcard projecting every in-scope variable, for use as the {@link select} projection
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#select SPARQL 1.1 SELECT}
 */
export function all() {
	return "*";
}

/**
 * Generates a SPARQL projection alias, naming a computed expression as a result variable.
 *
 * Wraps the expression and variable in the parenthesised `(expr as ?var)` form admitted in a
 * `select` projection list, where it introduces a computed column. The unparenthesised assignment
 * form, binding a variable in the WHERE body instead, is {@link bind}.
 *
 * @param expression The expression to project
 * @param variable The result variable the expression is named as
 *
 * @returns The parenthesised `(… as …)` projection alias
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#selectExpressions SPARQL 1.1 Select Expressions}
 */
export function as(expression: SPARQL, variable: SPARQL): SPARQL {
	return `(${expression} as ${variable})`;
}


//// Query Clauses (§15) ///////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL `WHERE` clause.
 *
 * Wraps the space-joined clauses in a `where { … }` block: the graph pattern a {@link select} or {@link ask} query
 * matches against, and the source a {@link deleet} or {@link insert} update draws its solutions from. Empty clauses,
 * such as those produced by {@link nil}, are dropped first; when none survives, the result is the empty fragment via
 * {@link nil}, which callers must guard against where a body is required.
 *
 * @param clauses The graph pattern clauses forming the query body
 *
 * @returns The SPARQL `WHERE` clause, or the empty fragment for no clauses
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#WritingSimpleQueries SPARQL 1.1 Writing Simple Queries}
 */
export function where(...clauses: readonly SPARQL[]): SPARQL {
	return map(clauses.filter(clause => clause !== ""), clauses =>
		clauses.length === 0 ? nil() : `where { ${fragment(...clauses)} }`
	);
}

/**
 * Generates a SPARQL `GROUP BY` clause.
 *
 * Prefixes the space-joined grouping expressions with `group by`, partitioning solutions for aggregation. Empty
 * expressions, such as those produced by {@link nil}, are dropped first; an empty list yields the empty fragment,
 * leaving the solutions ungrouped.
 *
 * @param expressions The grouping expressions
 *
 * @returns The SPARQL `GROUP BY` clause, or the empty fragment for no expressions
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#aggregates SPARQL 1.1 Aggregates}
 */
export function groupBy(...expressions: readonly SPARQL[]): SPARQL {
	return map(expressions.filter(expression => expression !== ""), expressions =>
		expressions.length === 0 ? nil() : `group by ${fragment(...expressions)}`
	);
}

/**
 * Generates a SPARQL `HAVING` clause.
 *
 * Wraps the conditions in a `having (…)` clause, filtering grouped solutions by aggregate conditions the way
 * {@link filter} constrains ungrouped ones; several conditions are each bracketed and conjoined with `&&`, the form
 * portable across engines. Empty conditions, such as those produced by {@link nil}, are dropped first; an empty list
 * yields the empty fragment, leaving the grouped solutions unfiltered.
 *
 * @param conditions The boolean constraint expressions over the grouped solutions
 *
 * @returns The SPARQL `HAVING` clause, or the empty fragment for no conditions
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#aggregates SPARQL 1.1 Aggregates}
 */
export function having(...conditions: readonly SPARQL[]): SPARQL {
	return map(conditions.filter(condition => condition !== ""), conditions =>
		conditions.length === 0 ? nil()
			: conditions.length === 1 ? `having (${conditions[0]})`
				: `having (${and(...conditions.map(condition => `(${condition})`))})`
	);
}

/**
 * Generates a SPARQL `ORDER BY` clause.
 *
 * Prefixes the space-joined order conditions with `order by`. Each condition is a bare expression for ascending order
 * or an {@link asc} or {@link desc} wrapper. Empty conditions, such as those produced by {@link nil}, are dropped
 * first; an empty list yields the empty fragment, leaving the solution sequence unordered.
 *
 * @param conditions The order conditions, in priority order
 *
 * @returns The SPARQL `ORDER BY` clause, or the empty fragment for no conditions
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#modOrderBy SPARQL 1.1 Order By}
 */
export function orderBy(...conditions: readonly SPARQL[]): SPARQL {
	return map(conditions.filter(condition => condition !== ""), conditions =>
		conditions.length === 0 ? nil() : `order by ${fragment(...conditions)}`
	);
}

/**
 * Generates a SPARQL `asc()` ascending order condition.
 *
 * @param expression The ordering expression
 *
 * @returns The `asc(…)` order condition
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#modOrderBy SPARQL 1.1 Order By}
 */
export function asc(expression: SPARQL): SPARQL {
	return `asc(${expression})`;
}

/**
 * Generates a SPARQL `desc()` descending order condition.
 *
 * @param expression The ordering expression
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
 * A `value` of `0` yields the empty fragment, leaving the number of solutions unbounded.
 *
 * @param value The maximum number of solutions to return
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
 * A `value` of `0` yields the empty fragment, skipping no leading solutions.
 *
 * @param value The number of leading solutions to skip
 *
 * @returns The SPARQL `OFFSET` clause, or the empty fragment for a `value` of `0`
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#modOffset SPARQL 1.1 Offset}
 */
export function offset(value: number): SPARQL {
	return value === 0 ? nil() : `offset ${value}`;
}


//// Graph Patterns (§8) ///////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL `UNION` pattern.
 *
 * Empty clauses, such as those produced by {@link nil}, are dropped first; a single surviving clause is returned
 * as-is, while several are wrapped in {@link group | groups} and joined with `union`. When none survives, the result
 * is the empty fragment via {@link nil}, which callers must guard against where a pattern is required.
 *
 * @param clauses The graph pattern clauses to combine
 *
 * @returns The SPARQL `UNION` pattern
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#alternatives SPARQL 1.1 Alternative Patterns}
 */
export function union(...clauses: readonly SPARQL[]): SPARQL {
	return map(clauses.filter(clause => clause !== ""), clauses =>
		clauses.length === 0 ? nil()
			: clauses.length === 1 ? clauses[0]
				: clauses.map(clause => group(clause)).join(" union ")
	);
}

/**
 * Generates a SPARQL `OPTIONAL` group pattern.
 *
 * Wraps the clauses in an `optional` group. Empty clauses, such as those produced by {@link nil}, are dropped first;
 * when none survives, the result is the empty fragment via {@link nil}, which callers must guard against where a
 * matching pattern is required.
 *
 * @param clauses The graph pattern clauses to wrap
 *
 * @returns The SPARQL `OPTIONAL` group pattern, or the empty fragment for no clauses
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#optionals SPARQL 1.1 Optional Patterns}
 */
export function optional(...clauses: readonly SPARQL[]): SPARQL {
	return map(clauses.filter(clause => clause !== ""), clauses =>
		clauses.length === 0 ? nil() : `optional { ${fragment(...clauses)} }`
	);
}

/**
 * Generates a SPARQL group graph pattern.
 *
 * Empty clauses, such as those produced by {@link nil}, are dropped first; when none survives, the result is the empty
 * fragment via {@link nil}, which callers must guard against where a pattern is required.
 *
 * @param clauses The graph pattern clauses to wrap
 *
 * @returns The braced SPARQL group pattern, or the empty fragment for no clauses
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#GroupPatterns SPARQL 1.1 Group Graph Patterns}
 */
export function group(...clauses: readonly SPARQL[]): SPARQL {
	return map(clauses.filter(clause => clause !== ""), clauses =>
		clauses.length === 0 ? nil() : `{ ${fragment(...clauses)} }`
	);
}

/**
 * Generates a SPARQL `MINUS` pattern.
 *
 * Wraps the clauses in a `minus` group, removing from the enclosing group every solution compatible with the wrapped
 * pattern. Empty clauses, such as those produced by {@link nil}, are dropped first; when none survives, the result is
 * the empty fragment via {@link nil}, which callers must guard against where a pattern is required.
 *
 * @param clauses The graph pattern clauses to subtract
 *
 * @returns The SPARQL `MINUS` pattern, or the empty fragment for no clauses
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#negation SPARQL 1.1 Negation}
 */
export function minus(...clauses: readonly SPARQL[]): SPARQL {
	return map(clauses.filter(clause => clause !== ""), clauses =>
		clauses.length === 0 ? nil() : `minus { ${fragment(...clauses)} }`
	);
}

/**
 * Generates a SPARQL `GRAPH` block scoping patterns to a named graph.
 *
 * Wraps the clauses in a `graph` block matched against the graph named by `name`, a {@link Variable} ranging over the
 * dataset's graph names or a fixed IRI {@link reference}. Empty clauses, such as those produced by {@link nil}, are
 * dropped first; when none survives, the result is the empty fragment via {@link nil}, which callers must guard against
 * where a pattern is required.
 *
 * @param name The serialised graph name: a variable or an IRI reference
 * @param clauses The graph pattern clauses to scope
 *
 * @returns The SPARQL `GRAPH` block, or the empty fragment for no clauses
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#queryDataset SPARQL 1.1 Querying the Dataset}
 */
export function graph(name: SPARQL, ...clauses: readonly SPARQL[]): SPARQL {
	return map(clauses.filter(clause => clause !== ""), clauses =>
		clauses.length === 0 ? nil() : `graph ${name} { ${fragment(...clauses)} }`
	);
}

/**
 * Generates a SPARQL `SERVICE` block delegating patterns to a federated endpoint.
 *
 * Wraps the clauses in a `service` block evaluated against the remote SPARQL endpoint identified by `endpoint`, a
 * {@link Variable} or a fixed IRI {@link reference}. Empty clauses, such as those produced by {@link nil}, are dropped
 * first; when none survives, the result is the empty fragment via {@link nil}, which callers must guard against where a
 * pattern is required.
 *
 * @param endpoint The serialised endpoint: a variable or an IRI reference
 * @param clauses The graph pattern clauses to delegate
 *
 * @returns The SPARQL `SERVICE` block, or the empty fragment for no clauses
 *
 * @see {@link https://www.w3.org/TR/sparql11-federated-query/#service SPARQL 1.1 Federated Query — SERVICE}
 */
export function service(endpoint: SPARQL, ...clauses: readonly SPARQL[]): SPARQL {
	return map(clauses.filter(clause => clause !== ""), clauses =>
		clauses.length === 0 ? nil() : `service ${endpoint} { ${fragment(...clauses)} }`
	);
}

/**
 * Generates a SPARQL `VALUES` inline-data block.
 *
 * Binds the `variables` to each row of `rows` in turn, supplying inline solutions the enclosing pattern joins against.
 * Every row lists one value per variable, using the `undef` keyword for an unbound position. An empty row list yields
 * an empty `values (…) { }` block matching nothing. Empty variables and terms, such as those produced by {@link nil},
 * are dropped before joining, so a position marked unbound must use `undef` rather than an empty fragment to keep rows
 * aligned with the variable list.
 *
 * @param variables The serialised variables bound by the block
 * @param rows The value rows, each a list of serialised terms positionally aligned with `variables`
 *
 * @returns The SPARQL `VALUES` block
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#inline-data SPARQL 1.1 Inline Data}
 */
export function values(variables: readonly SPARQL[], rows: readonly (readonly SPARQL[])[]): SPARQL {
	return `values (${variables.filter(variable => variable !== "").join(" ")}) { ${fragment(...rows.map(row =>
		`(${row.filter(term => term !== "").join(" ")})`
	))} }`;
}

/**
 * Generates a single {@link SPARQL} fragment by joining clauses.
 *
 * Empty clauses, such as those produced by {@link nil}, are dropped before joining, so optional clauses left out do not
 * introduce redundant spaces.
 *
 * @param clauses The clauses to join
 *
 * @returns The space-joined fragment, excluding empty clauses
 */
export function fragment(...clauses: readonly SPARQL[]): SPARQL {
	return clauses.filter(clause => clause !== "").join(" ");
}

/**
 * Assembles a SPARQL `subject predicate object .` statement from pre-rendered terms.
 *
 * The shared primitive behind {@link triple} and {@link pattern}: space-joins three already-serialised {@link SPARQL}
 * terms and appends the statement terminator. Callers render each position to its SPARQL form before passing it in.
 *
 * @param subject The serialised subject term
 * @param predicate The serialised predicate term
 * @param object The serialised object term
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
 * @param constraint The boolean constraint expression to wrap
 *
 * @returns The SPARQL `FILTER` constraint
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#expressions SPARQL 1.1 Filters}
 */
export function filter(constraint: SPARQL): SPARQL {
	return `filter(${constraint})`;
}

/**
 * Generates a SPARQL `bind` clause, assigning a computed expression to a variable in the WHERE body.
 *
 * Introduces a new in-scope variable bound to the expression's value at the point the clause
 * appears, so subsequent patterns and filters can reference it. The projection-list counterpart,
 * naming a computed `select` column, is {@link as}.
 *
 * @param expression The expression to assign
 * @param variable The variable the expression is bound to
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
 * Joins the path elements with `/`, matching nodes reached by following each element in turn. A sequence binds tighter
 * than an {@link alt | alternative}, so it nests inside one without parentheses. Empty elements, such as those produced
 * by {@link nil}, are dropped first, and a single surviving element is returned unchanged.
 *
 * @param paths The path elements to chain, in traversal order
 *
 * @returns The `/`-joined sequence path, excluding empty elements
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#propertypaths SPARQL 1.1 Property Paths}
 */
export function seq(...paths: readonly SPARQL[]): SPARQL {
	return paths.filter(path => path !== "").join("/");
}

/**
 * Generates a SPARQL alternative property path.
 *
 * Joins the path elements with `|`, matching nodes reachable by any one of them. As the lowest-precedence path
 * operator, it admits {@link seq | sequences} as elements without parentheses. Empty elements, such as those produced
 * by {@link nil}, are dropped first, and a single surviving element is returned unchanged.
 *
 * @param paths The alternative path elements
 *
 * @returns The `|`-joined alternative path, excluding empty elements
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#propertypaths SPARQL 1.1 Property Paths}
 */
export function alt(...paths: readonly SPARQL[]): SPARQL {
	return paths.filter(path => path !== "").join("|");
}

/**
 * Generates a SPARQL inverse property path.
 *
 * Prefixes the path with `^`, traversing it from object to subject. The operand must be a path primary, such as an IRI
 * {@link reference} or a parenthesised path, so the inverse binds to the whole element.
 *
 * @param path The path element to invert
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
 * Suffixes the path with `*`, matching the element traversed any number of times, the zero-length path included. The
 * operand must be a path primary so the quantifier binds to the whole element.
 *
 * @param path The path element to repeat
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
 * Suffixes the path with `+`, matching the element traversed at least once. The operand must be a path primary so the
 * quantifier binds to the whole element.
 *
 * @param path The path element to repeat
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
 * Suffixes the path with `?`, matching the element traversed at most once. The operand must be a path primary so the
 * quantifier binds to the whole element.
 *
 * @param path The path element to make optional
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
 * Prefixes the predicate set with `!`, matching any predicate outside it; an {@link inv | inverse} entry negates the
 * reverse direction. Empty predicates, such as those produced by {@link nil}, are dropped first; a single surviving
 * predicate renders as `!pred`, while several render as the parenthesised `!(a|b)` form.
 *
 * @param predicates The forbidden predicates, each an IRI reference or the inverse of one
 *
 * @returns The `!`-prefixed none property set
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#propertypaths SPARQL 1.1 Property Paths}
 */
export function none(...predicates: readonly SPARQL[]): SPARQL {
	return map(predicates.filter(predicate => predicate !== ""), set =>
		set.length === 1 ? `!${set[0]}` : `!(${set.join("|")})`
	);
}


//// Logical Operators (§17.3) /////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL logical negation (`!`) of a boolean expression.
 *
 * Parenthesises the operand so the negation binds the whole expression regardless of its internal
 * operator precedence.
 *
 * @param condition The boolean expression to negate
 *
 * @returns The parenthesised `!(…)` negation
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-not SPARQL 1.1 Logical Not}
 */
export function not(condition: SPARQL): SPARQL {
	return `!(${condition})`;
}

/**
 * Generates a SPARQL logical conjunction (`&&`) of boolean expressions.
 *
 * Joins the operands with `&&`, which binds tighter than the `||` of {@link or}, so an `and` term
 * nests inside an `or` without parentheses. Empty operands, such as those produced by {@link nil}, are
 * dropped first; a single surviving operand is returned unchanged, and no surviving operand yields the
 * empty fragment, which callers must guard against where a constraint is required.
 *
 * @param conditions The boolean expressions to conjoin
 *
 * @returns The `&&`-joined conjunction, excluding empty operands
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-logical-and SPARQL 1.1 Logical And}
 */
export function and(...conditions: readonly SPARQL[]): SPARQL {
	return conditions.filter(condition => condition !== "").join(" && ");
}

/**
 * Generates a SPARQL logical disjunction (`||`) of boolean expressions.
 *
 * Joins the operands with `||`, the lowest-precedence boolean operator, so {@link and} conjunctions
 * nest inside without parentheses. Empty operands, such as those produced by {@link nil}, are dropped
 * first; a single surviving operand is returned unchanged, and no surviving operand yields the empty
 * fragment, which callers must guard against where a constraint is required.
 *
 * @param conditions The boolean expressions to disjoin
 *
 * @returns The `||`-joined disjunction, excluding empty operands
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-logical-or SPARQL 1.1 Logical Or}
 */
export function or(...conditions: readonly SPARQL[]): SPARQL {
	return conditions.filter(condition => condition !== "").join(" || ");
}


//// Comparison Operators (§17.3) //////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL equality (`=`) comparison.
 *
 * @param x The left operand expression
 * @param y The right operand expression
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
 * @param x The left operand expression
 * @param y The right operand expression
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
 * @param x The left operand expression
 * @param y The right operand expression
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
 * @param x The left operand expression
 * @param y The right operand expression
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
 * @param x The left operand expression
 * @param y The right operand expression
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
 * @param x The left operand expression
 * @param y The right operand expression
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
 * Generates a SPARQL addition (`+`) of two numeric expressions.
 *
 * Parenthesises the operands so the sum binds as a unit regardless of the surrounding operator precedence.
 *
 * @param x The left operand expression
 * @param y The right operand expression
 *
 * @returns The parenthesised `(… + …)` sum
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#OperatorMapping SPARQL 1.1 Operator Mapping}
 */
export function add(x: SPARQL, y: SPARQL): SPARQL {
	return `(${x} + ${y})`;
}

/**
 * Generates a SPARQL subtraction (`-`) of two numeric expressions.
 *
 * Parenthesises the operands so the difference binds as a unit regardless of the surrounding operator precedence.
 *
 * @param x The left operand expression
 * @param y The right operand expression
 *
 * @returns The parenthesised `(… - …)` difference
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#OperatorMapping SPARQL 1.1 Operator Mapping}
 */
export function sub(x: SPARQL, y: SPARQL): SPARQL {
	return `(${x} - ${y})`;
}

/**
 * Generates a SPARQL multiplication (`*`) of two numeric expressions.
 *
 * Parenthesises the operands so the product binds as a unit regardless of the surrounding operator precedence.
 *
 * @param x The left operand expression
 * @param y The right operand expression
 *
 * @returns The parenthesised `(… * …)` product
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#OperatorMapping SPARQL 1.1 Operator Mapping}
 */
export function mul(x: SPARQL, y: SPARQL): SPARQL {
	return `(${x} * ${y})`;
}

/**
 * Generates a SPARQL division (`/`) of two numeric expressions.
 *
 * Parenthesises the operands so the quotient binds as a unit regardless of the surrounding operator precedence.
 *
 * @param x The left operand (dividend) expression
 * @param y The right operand (divisor) expression
 *
 * @returns The parenthesised `(… / …)` quotient
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#OperatorMapping SPARQL 1.1 Operator Mapping}
 */
export function div(x: SPARQL, y: SPARQL): SPARQL {
	return `(${x} / ${y})`;
}


//// Functional Forms (§17.4.1) ////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL `if()` conditional expression.
 *
 * Evaluates to `then` when `condition` holds and to `otherwise` when it fails. SPARQL keeps the
 * unselected branch lazy (§17.4.1.2), so a branch that would raise an evaluation error is left
 * unevaluated unless selected.
 *
 * @param condition The boolean test expression
 * @param then The expression selected when `condition` evaluates to `true`
 * @param otherwise The expression selected when `condition` evaluates to `false`
 *
 * @returns The `if(…)` conditional expression
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-if SPARQL 1.1 if}
 */
export function iif(condition: SPARQL, then: SPARQL, otherwise: SPARQL): SPARQL {
	return `if(${condition}, ${then}, ${otherwise})`;
}

/**
 * Generates a SPARQL `coalesce()` call returning the first argument that evaluates without error.
 *
 * Yields the value of the first listed expression that is bound and raises no evaluation error,
 * scanning left to right; the call is itself unbound only when every argument is. Used to supply a
 * fallback where an inner expression may be unbound or out of domain. Empty argument expressions, such
 * as those produced by {@link nil}, are dropped before joining.
 *
 * @param expressions The candidate expressions, in priority order
 *
 * @returns The `coalesce(…)` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-coalesce SPARQL 1.1 coalesce}
 */
export function coalesce(...expressions: readonly SPARQL[]): SPARQL {
	return `coalesce(${expressions.filter(expression => expression !== "").join(", ")})`;
}

/**
 * Generates a SPARQL `bound()` variable-binding test.
 *
 * Evaluates to `true` when the variable holds a value in the current solution: the test
 * distinguishing a present value from an absent one, for example over the unmatched side of an
 * {@link optional} pattern.
 *
 * @param expression The variable expression to test
 *
 * @returns The `bound()` test
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-bound SPARQL 1.1 bound}
 */
export function isBound(expression: SPARQL): SPARQL {
	return `bound(${expression})`;
}

/**
 * Generates a SPARQL set-membership (`IN`) test.
 *
 * Evaluates to `true` when the expression equals any listed option under value comparison. Empty
 * options, such as those produced by {@link nil}, are dropped first; an empty option list renders
 * `in ()`, which is always `false`, so callers that treat an empty set as unconstrained must guard the
 * call.
 *
 * @param expression The expression to test
 * @param options The candidate value expressions
 *
 * @returns The `… in (…)` membership test
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-in SPARQL 1.1 In}
 */
export function isIn(expression: SPARQL, options: readonly SPARQL[]): SPARQL {
	return `${expression} in (${options.filter(option => option !== "").join(", ")})`;
}

/**
 * Generates a SPARQL set-non-membership (`NOT IN`) test.
 *
 * The negation of {@link isIn}: evaluates to `true` when the expression equals none of the listed
 * options under value comparison. Empty options, such as those produced by {@link nil}, are dropped
 * first; an empty option list renders `not in ()`, which is always `true`, so callers that treat an
 * empty set as unconstrained must guard the call.
 *
 * @param expression The expression to test
 * @param options The candidate value expressions
 *
 * @returns The `… not in (…)` non-membership test
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-not-in SPARQL 1.1 Not In}
 */
export function isNotIn(expression: SPARQL, options: readonly SPARQL[]): SPARQL {
	return `${expression} not in (${options.filter(option => option !== "").join(", ")})`;
}

/**
 * Generates a SPARQL `exists` graph-pattern test.
 *
 * Evaluates to `true` when the wrapped pattern has at least one solution in the enclosing context,
 * without binding any of its variables outward. The clauses are {@link fragment | space-joined} into
 * a single group. Empty clauses, such as those produced by {@link nil}, are dropped first; when none survives, the
 * result is the empty fragment via {@link nil}, which callers must guard against where a pattern is required.
 *
 * @param patterns The graph pattern clauses to test for a match
 *
 * @returns The `exists { … }` test, or the empty fragment for no patterns
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-filter-exists SPARQL 1.1 Filter Exists}
 */
export function exists(...patterns: readonly SPARQL[]): SPARQL {
	return map(patterns.filter(pattern => pattern !== ""), patterns =>
		patterns.length === 0 ? nil() : `exists { ${fragment(...patterns)} }`
	);
}

/**
 * Generates a SPARQL `not exists` graph-pattern test.
 *
 * The negation of {@link exists}: evaluates to `true` when the wrapped pattern has no solution in the
 * enclosing context. The clauses are {@link fragment | space-joined} into a single group. Empty clauses, such as those
 * produced by {@link nil}, are dropped first; when none survives, the result is the empty fragment via {@link nil},
 * which callers must guard against where a pattern is required.
 *
 * @param patterns The graph pattern clauses to test for absence
 *
 * @returns The `not exists { … }` test, or the empty fragment for no patterns
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-filter-exists SPARQL 1.1 Filter Exists}
 */
export function nexists(...patterns: readonly SPARQL[]): SPARQL {
	return map(patterns.filter(pattern => pattern !== ""), patterns =>
		patterns.length === 0 ? nil() : `not exists { ${fragment(...patterns)} }`
	);
}

/**
 * Generates a SPARQL function call from a function name and argument expressions.
 *
 * The generic escape hatch for SPARQL functions without a dedicated builder ({@link str},
 * {@link datatype}, …): renders `fn(arg, …)` with the arguments comma-joined. Empty arguments, such as
 * those produced by {@link nil}, are dropped first. The name is emitted verbatim, so the caller upholds
 * the lowercase generated-token convention.
 *
 * @param fn The SPARQL function name
 * @param args The argument expressions, in order
 *
 * @returns The `fn(…)` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#SparqlOps SPARQL 1.1 Function Library}
 */
export function call(fn: Identifier, ...args: readonly SPARQL[]): SPARQL {
	return `${fn}(${args.filter(arg => arg !== "").join(", ")})`;
}


//// RDF Term Functions (§17.4.2) //////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL `str()` call rendering a term's lexical form as a plain literal.
 *
 * Drops the language tag or datatype of a literal and returns its lexical string; over an IRI it
 * returns the IRI string.
 *
 * @param expression The expression evaluating to the term to render
 *
 * @returns The `str()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-str SPARQL 1.1 str}
 */
export function str(expression: SPARQL): SPARQL {
	return `str(${expression})`;
}

/**
 * Generates a SPARQL `lang()` call extracting a literal's language tag.
 *
 * Returns the BCP 47 language tag of a language-tagged literal, or the empty string for a literal
 * carrying no tag.
 *
 * @param expression The expression evaluating to the literal to inspect
 *
 * @returns The `lang()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-lang SPARQL 1.1 lang}
 */
export function lang(expression: SPARQL): SPARQL {
	return `lang(${expression})`;
}

/**
 * Generates a SPARQL `datatype()` call extracting a literal's datatype IRI.
 *
 * Returns the datatype IRI of a typed literal, `xsd:string` for a plain literal, and `rdf:langString`
 * for a language-tagged one; raises on a non-literal term.
 *
 * @param expression The expression evaluating to the literal to inspect
 *
 * @returns The `datatype()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-datatype SPARQL 1.1 datatype}
 */
export function datatype(expression: SPARQL): SPARQL {
	return `datatype(${expression})`;
}

/**
 * Generates a SPARQL `isblank()` term-kind test.
 *
 * Evaluates to `true` when the term is a blank node, `false` for an IRI or literal. Emitted lowercase per the
 * generated-query convention (SPARQL function names are case-insensitive).
 *
 * @param expression The term expression to test
 *
 * @returns The `isblank()` test
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-isBlank SPARQL 1.1 isBlank}
 */
export function isBlank(expression: SPARQL): SPARQL {
	return `isblank(${expression})`;
}

/**
 * Generates a SPARQL `isiri()` term-kind test.
 *
 * Evaluates to `true` when the term is an IRI, `false` for a literal or blank node. Emitted lowercase
 * per the generated-query convention (SPARQL function names are case-insensitive).
 *
 * @param expression The term expression to test
 *
 * @returns The `isiri()` test
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-isIRI SPARQL 1.1 isIRI}
 */
export function isIRI(expression: SPARQL): SPARQL {
	return `isiri(${expression})`;
}

/**
 * Generates a SPARQL `isliteral()` term-kind test.
 *
 * Evaluates to `true` when the term is an RDF literal, `false` for an IRI or blank node. Emitted
 * lowercase per the generated-query convention (SPARQL function names are case-insensitive).
 *
 * @param expression The term expression to test
 *
 * @returns The `isliteral()` test
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-isLiteral SPARQL 1.1 isLiteral}
 */
export function isLiteral(expression: SPARQL): SPARQL {
	return `isliteral(${expression})`;
}

/**
 * Generates a SPARQL `isnumeric()` term-kind test.
 *
 * Evaluates to `true` when the term is a numeric literal, `false` for any other term. Emitted lowercase per the
 * generated-query convention (SPARQL function names are case-insensitive).
 *
 * @param expression The term expression to test
 *
 * @returns The `isnumeric()` test
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-isNumeric SPARQL 1.1 isNumeric}
 */
export function isNumeric(expression: SPARQL): SPARQL {
	return `isnumeric(${expression})`;
}

/**
 * Generates a SPARQL `sameterm()` identity test.
 *
 * Evaluates to `true` when both expressions are the same RDF term, comparing by term identity rather than the value
 * comparison of {@link eq}: literals match only on identical lexical form and datatype or language tag. Emitted
 * lowercase per the generated-query convention.
 *
 * @param x The left term expression
 * @param y The right term expression
 *
 * @returns The `sameterm()` test
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-sameTerm SPARQL 1.1 sameTerm}
 */
export function sameTerm(x: SPARQL, y: SPARQL): SPARQL {
	return `sameterm(${x}, ${y})`;
}

/**
 * Generates a SPARQL `iri()` call constructing an IRI from a string expression.
 *
 * Resolves the argument's lexical form against the query base IRI where relative, returning an IRI term; over an IRI
 * argument it returns the IRI unchanged.
 *
 * @param expression The expression evaluating to the IRI string to construct
 *
 * @returns The `iri()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-iri SPARQL 1.1 IRI}
 */
export function iri(expression: SPARQL): SPARQL {
	return `iri(${expression})`;
}

/**
 * Generates a SPARQL `bnode()` call minting a blank node.
 *
 * Without an argument, mints a fresh blank node distinct on each call. With a string-valued `expression`, produces a
 * blank node correlated to that string within the solution, so equal arguments yield the same node.
 *
 * @param expression The expression correlating minted nodes within a solution, or omitted to mint a fresh node
 *
 * @returns The `bnode()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-bnode SPARQL 1.1 BNODE}
 */
export function bnode(expression?: SPARQL): SPARQL {
	return expression === undefined ? "bnode()" : `bnode(${expression})`;
}

/**
 * Generates a SPARQL `strdt()` call constructing a datatype-annotated literal.
 *
 * Pairs the lexical form of `expression` with the `datatype` IRI, producing a typed literal.
 *
 * @param expression The expression evaluating to the lexical form
 * @param datatype The expression evaluating to the datatype IRI, typically a {@link reference}
 *
 * @returns The `strdt()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-strdt SPARQL 1.1 STRDT}
 */
export function strdt(expression: SPARQL, datatype: SPARQL): SPARQL {
	return `strdt(${expression}, ${datatype})`;
}

/**
 * Generates a SPARQL `strlang()` call constructing a language-tagged literal.
 *
 * Pairs the lexical form of `expression` with the `language` tag, producing a language-tagged string literal.
 *
 * @param expression The expression evaluating to the lexical form
 * @param language The expression evaluating to the language tag, typically a {@link literal}
 *
 * @returns The `strlang()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-strlang SPARQL 1.1 STRLANG}
 */
export function strlang(expression: SPARQL, language: SPARQL): SPARQL {
	return `strlang(${expression}, ${language})`;
}

/**
 * Generates a SPARQL `uuid()` call minting a fresh UUID IRI.
 *
 * @returns The `uuid()` call, yielding a fresh `urn:uuid:` IRI on each evaluation
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-uuid SPARQL 1.1 UUID}
 */
export function uuid(): SPARQL {
	return "uuid()";
}

/**
 * Generates a SPARQL `struuid()` call minting a fresh UUID string.
 *
 * @returns The `struuid()` call, yielding a fresh UUID lexical form on each evaluation
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-struuid SPARQL 1.1 STRUUID}
 */
export function struuid(): SPARQL {
	return "struuid()";
}


//// String Functions (§17.4.3) ////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL `strlen()` call returning a string's length.
 *
 * @param expression The expression evaluating to the string to measure
 *
 * @returns The `strlen()` call, yielding the length in characters
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-strlen SPARQL 1.1 STRLEN}
 */
export function strlen(expression: SPARQL): SPARQL {
	return `strlen(${expression})`;
}

/**
 * Generates a SPARQL `substr()` call extracting a substring.
 *
 * Returns the substring of `source` starting at the 1-based `starting` position; with `length`, limits the result to
 * that many characters, otherwise runs to the end.
 *
 * @param source The expression evaluating to the source string
 * @param starting The expression evaluating to the 1-based start position
 * @param length The expression evaluating to the maximum length, or omitted to run to the end
 *
 * @returns The `substr()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-substr SPARQL 1.1 SUBSTR}
 */
export function substr(source: SPARQL, starting: SPARQL, length?: SPARQL): SPARQL {
	return length === undefined ? `substr(${source}, ${starting})` : `substr(${source}, ${starting}, ${length})`;
}

/**
 * Generates a SPARQL `ucase()` call upper-casing a string.
 *
 * @param expression The expression evaluating to the string to upper-case
 *
 * @returns The `ucase()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-ucase SPARQL 1.1 UCASE}
 */
export function ucase(expression: SPARQL): SPARQL {
	return `ucase(${expression})`;
}

/**
 * Generates a SPARQL `lcase()` call lower-casing a string.
 *
 * @param expression The expression evaluating to the string to lower-case
 *
 * @returns The `lcase()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-lcase SPARQL 1.1 LCASE}
 */
export function lcase(expression: SPARQL): SPARQL {
	return `lcase(${expression})`;
}

/**
 * Generates a SPARQL `strstarts()` call testing a string prefix.
 *
 * Evaluates to `true` when `source` starts with `prefix`.
 *
 * @param source The expression evaluating to the string to test
 * @param prefix The expression evaluating to the candidate prefix
 *
 * @returns The `strstarts()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-strstarts SPARQL 1.1 STRSTARTS}
 */
export function strstarts(source: SPARQL, prefix: SPARQL): SPARQL {
	return `strstarts(${source}, ${prefix})`;
}

/**
 * Generates a SPARQL `strends()` call testing a string suffix.
 *
 * Evaluates to `true` when `source` ends with `suffix`.
 *
 * @param source The expression evaluating to the string to test
 * @param suffix The expression evaluating to the candidate suffix
 *
 * @returns The `strends()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-strends SPARQL 1.1 STRENDS}
 */
export function strends(source: SPARQL, suffix: SPARQL): SPARQL {
	return `strends(${source}, ${suffix})`;
}

/**
 * Generates a SPARQL `contains()` call testing for a substring.
 *
 * Evaluates to `true` when `source` contains `substring`.
 *
 * @param source The expression evaluating to the string to search
 * @param substring The expression evaluating to the substring to find
 *
 * @returns The `contains()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-contains SPARQL 1.1 CONTAINS}
 */
export function contains(source: SPARQL, substring: SPARQL): SPARQL {
	return `contains(${source}, ${substring})`;
}

/**
 * Generates a SPARQL `strbefore()` call returning the portion before a substring.
 *
 * Returns the portion of `source` preceding the first occurrence of `substring`, or the empty string when `substring`
 * is absent.
 *
 * @param source The expression evaluating to the source string
 * @param substring The expression evaluating to the delimiting substring
 *
 * @returns The `strbefore()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-strbefore SPARQL 1.1 STRBEFORE}
 */
export function strbefore(source: SPARQL, substring: SPARQL): SPARQL {
	return `strbefore(${source}, ${substring})`;
}

/**
 * Generates a SPARQL `strafter()` call returning the portion after a substring.
 *
 * Returns the portion of `source` following the first occurrence of `substring`, or the empty string when `substring`
 * is absent.
 *
 * @param source The expression evaluating to the source string
 * @param substring The expression evaluating to the delimiting substring
 *
 * @returns The `strafter()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-strafter SPARQL 1.1 STRAFTER}
 */
export function strafter(source: SPARQL, substring: SPARQL): SPARQL {
	return `strafter(${source}, ${substring})`;
}

/**
 * Generates a SPARQL `encode_for_uri()` call percent-encoding a string.
 *
 * Percent-encodes `expression` for safe inclusion in a URI path segment.
 *
 * @param expression The expression evaluating to the string to encode
 *
 * @returns The `encode_for_uri()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-encode SPARQL 1.1 ENCODE_FOR_URI}
 */
export function encodeForUri(expression: SPARQL): SPARQL {
	return `encode_for_uri(${expression})`;
}

/**
 * Generates a SPARQL `concat()` call joining string expressions.
 *
 * Concatenates the arguments left to right into a single string. Empty argument expressions, such as those produced by
 * {@link nil}, are dropped before joining.
 *
 * @param expressions The expressions evaluating to the strings to join, in order
 *
 * @returns The `concat()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-concat SPARQL 1.1 CONCAT}
 */
export function concat(...expressions: readonly SPARQL[]): SPARQL {
	return `concat(${expressions.filter(expression => expression !== "").join(", ")})`;
}

/**
 * Generates a SPARQL `langmatches()` call testing a language tag against a range.
 *
 * Tests the tag against `range` by RFC 4647 basic filtering: a match when the tag equals the range
 * or extends it by a subtag. The `range` is a basic RFC 4647 language range: a sequence of subtags or
 * the standalone `*` wildcard. Emitted lowercase per the generated-query convention.
 *
 * @param expression The expression evaluating to the language tag to test, typically a {@link lang} call
 * @param range The basic RFC 4647 language range to match against
 *
 * @returns The `langmatches()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-langMatches SPARQL 1.1 langMatches}
 */
export function langMatches(expression: SPARQL, range: TagRange): SPARQL {
	return `langmatches(${expression}, ${literal(range)})`;
}

/**
 * Generates a SPARQL `regex()` call testing a string against a pattern.
 *
 * Evaluates to `true` when `text` matches the regular expression `pattern`; with `flags`, applies the match modifiers,
 * such as `"i"` for case-insensitivity.
 *
 * @param text The expression evaluating to the string to test
 * @param pattern The expression evaluating to the regular-expression pattern, typically a {@link literal}
 * @param flags The expression evaluating to the match flags, or omitted for none
 *
 * @returns The `regex()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-regex SPARQL 1.1 REGEX}
 */
export function regex(text: SPARQL, pattern: SPARQL, flags?: SPARQL): SPARQL {
	return flags === undefined ? `regex(${text}, ${pattern})` : `regex(${text}, ${pattern}, ${flags})`;
}

/**
 * Generates a SPARQL `replace()` call substituting pattern matches.
 *
 * Replaces each match of the regular expression `pattern` in `text` with `replacement`; with `flags`, applies the match
 * modifiers, such as `"i"` for case-insensitivity.
 *
 * @param text The expression evaluating to the string to transform
 * @param pattern The expression evaluating to the regular-expression pattern, typically a {@link literal}
 * @param replacement The expression evaluating to the replacement template
 * @param flags The expression evaluating to the match flags, or omitted for none
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
 * Generates a SPARQL `abs()` call returning a number's absolute value.
 *
 * @param expression The expression evaluating to the number
 *
 * @returns The `abs()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-abs SPARQL 1.1 abs}
 */
export function abs(expression: SPARQL): SPARQL {
	return `abs(${expression})`;
}

/**
 * Generates a SPARQL `round()` call rounding a number to the nearest integer.
 *
 * @param expression The expression evaluating to the number
 *
 * @returns The `round()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-round SPARQL 1.1 round}
 */
export function round(expression: SPARQL): SPARQL {
	return `round(${expression})`;
}

/**
 * Generates a SPARQL `ceil()` call rounding a number up to an integer.
 *
 * @param expression The expression evaluating to the number
 *
 * @returns The `ceil()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-ceil SPARQL 1.1 ceil}
 */
export function ceil(expression: SPARQL): SPARQL {
	return `ceil(${expression})`;
}

/**
 * Generates a SPARQL `floor()` call rounding a number down to an integer.
 *
 * @param expression The expression evaluating to the number
 *
 * @returns The `floor()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-floor SPARQL 1.1 floor}
 */
export function floor(expression: SPARQL): SPARQL {
	return `floor(${expression})`;
}

/**
 * Generates a SPARQL `rand()` call returning a random number.
 *
 * @returns The `rand()` call, yielding a fresh double in `[0, 1)` on each evaluation
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-rand SPARQL 1.1 RAND}
 */
export function rand(): SPARQL {
	return "rand()";
}


//// Temporal Functions (§17.4.5) //////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL `now()` call returning the query execution timestamp.
 *
 * @returns The `now()` call, yielding the `xsd:dateTime` fixed for the query execution
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-now SPARQL 1.1 now}
 */
export function now(): SPARQL {
	return "now()";
}

/**
 * Generates a SPARQL `year()` call extracting a dateTime's year.
 *
 * @param expression The expression evaluating to the `xsd:dateTime`
 *
 * @returns The `year()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-year SPARQL 1.1 year}
 */
export function year(expression: SPARQL): SPARQL {
	return `year(${expression})`;
}

/**
 * Generates a SPARQL `month()` call extracting a dateTime's month.
 *
 * @param expression The expression evaluating to the `xsd:dateTime`
 *
 * @returns The `month()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-month SPARQL 1.1 month}
 */
export function month(expression: SPARQL): SPARQL {
	return `month(${expression})`;
}

/**
 * Generates a SPARQL `day()` call extracting a dateTime's day.
 *
 * @param expression The expression evaluating to the `xsd:dateTime`
 *
 * @returns The `day()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-day SPARQL 1.1 day}
 */
export function day(expression: SPARQL): SPARQL {
	return `day(${expression})`;
}

/**
 * Generates a SPARQL `hours()` call extracting a dateTime's hours.
 *
 * @param expression The expression evaluating to the `xsd:dateTime`
 *
 * @returns The `hours()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-hours SPARQL 1.1 hours}
 */
export function hours(expression: SPARQL): SPARQL {
	return `hours(${expression})`;
}

/**
 * Generates a SPARQL `minutes()` call extracting a dateTime's minutes.
 *
 * @param expression The expression evaluating to the `xsd:dateTime`
 *
 * @returns The `minutes()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-minutes SPARQL 1.1 minutes}
 */
export function minutes(expression: SPARQL): SPARQL {
	return `minutes(${expression})`;
}

/**
 * Generates a SPARQL `seconds()` call extracting a dateTime's seconds.
 *
 * @param expression The expression evaluating to the `xsd:dateTime`
 *
 * @returns The `seconds()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-seconds SPARQL 1.1 seconds}
 */
export function seconds(expression: SPARQL): SPARQL {
	return `seconds(${expression})`;
}

/**
 * Generates a SPARQL `timezone()` call extracting a dateTime's timezone as a duration.
 *
 * Returns the timezone offset as an `xsd:dayTimeDuration`, raising when the argument carries no timezone; the
 * string-valued {@link tz} variant returns the empty string instead.
 *
 * @param expression The expression evaluating to the `xsd:dateTime`
 *
 * @returns The `timezone()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-timezone SPARQL 1.1 timezone}
 */
export function timezone(expression: SPARQL): SPARQL {
	return `timezone(${expression})`;
}

/**
 * Generates a SPARQL `tz()` call extracting a dateTime's timezone as a string.
 *
 * Returns the timezone offset as a string, or the empty string when the argument carries no timezone; the
 * duration-valued {@link timezone} variant raises instead.
 *
 * @param expression The expression evaluating to the `xsd:dateTime`
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
 * Generates a SPARQL `md5()` call returning a string's MD5 digest.
 *
 * @param expression The expression evaluating to the string to digest
 *
 * @returns The `md5()` call, yielding the digest as a hex string
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-md5 SPARQL 1.1 MD5}
 */
export function md5(expression: SPARQL): SPARQL {
	return `md5(${expression})`;
}

/**
 * Generates a SPARQL `sha1()` call returning a string's SHA-1 digest.
 *
 * @param expression The expression evaluating to the string to digest
 *
 * @returns The `sha1()` call, yielding the digest as a hex string
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-sha1 SPARQL 1.1 SHA1}
 */
export function sha1(expression: SPARQL): SPARQL {
	return `sha1(${expression})`;
}

/**
 * Generates a SPARQL `sha256()` call returning a string's SHA-256 digest.
 *
 * @param expression The expression evaluating to the string to digest
 *
 * @returns The `sha256()` call, yielding the digest as a hex string
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-sha256 SPARQL 1.1 SHA256}
 */
export function sha256(expression: SPARQL): SPARQL {
	return `sha256(${expression})`;
}

/**
 * Generates a SPARQL `sha384()` call returning a string's SHA-384 digest.
 *
 * @param expression The expression evaluating to the string to digest
 *
 * @returns The `sha384()` call, yielding the digest as a hex string
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-sha384 SPARQL 1.1 SHA384}
 */
export function sha384(expression: SPARQL): SPARQL {
	return `sha384(${expression})`;
}

/**
 * Generates a SPARQL `sha512()` call returning a string's SHA-512 digest.
 *
 * @param expression The expression evaluating to the string to digest
 *
 * @returns The `sha512()` call, yielding the digest as a hex string
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
 * Counts the solutions in a group, or the bindings of `expression` when one is supplied. Wrap the argument in
 * {@link distinct} to count distinct values; omit it to count every solution as `count(*)`.
 *
 * @param expression The expression whose bindings are counted, or omitted to count all solutions
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
 * @param expression The numeric expression to total over the group
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
 * @param expression The expression to take the minimum of over the group
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
 * @param expression The expression to take the maximum of over the group
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
 * @param expression The numeric expression to average over the group
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
 * Returns an arbitrary value from the group's bindings of `expression`, used to carry a non-grouped column through an
 * aggregating query.
 *
 * @param expression The expression to sample a binding from over the group
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
 * Concatenates the group's string bindings of `expression`. With a `separator`, inserts it between values via the
 * `separator=` keyword argument; without one, SPARQL defaults to a single space.
 *
 * @param expression The expression whose string bindings are concatenated
 * @param separator The string inserted between values, or omitted for the default single space
 *
 * @returns The `group_concat(…)` aggregate
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#defn_aggGroupConcat SPARQL 1.1 GroupConcat}
 */
export function groupConcat(expression: SPARQL, separator?: string): SPARQL {
	return separator === undefined
		? `group_concat(${expression})`
		: `group_concat(${expression}; separator=${literal(separator)})`;
}


//// Serialisers (§4) //////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates SPARQL triple data from a {@link Triple} sequence.
 *
 * Renders each triple via {@link triple} as `subject predicate object .` and space-joins them, so the empty sequence
 * yields the empty string. The predicate `"a"` shorthand is expanded to the full `rdf:type` IRI.
 *
 * @param triples The triples to serialise
 *
 * @returns The generated triple data, space-joined, or the empty string for an empty sequence
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#QSynTriples SPARQL 1.1 Triple Patterns}
 */
export function triples(triples: readonly Triple[]): SPARQL {
	return triples.map(triple).join(" ");
}

/**
 * Generates the SPARQL representation of a single {@link Triple}.
 *
 * Renders the triple as `subject predicate object .`. The subject and object are rendered via {@link term} and the
 * predicate via {@link reference}, with the `"a"`
 * ({@link https://www.w3.org/TR/sparql11-query/#abbrevRdfType SPARQL `rdf:type` shorthand}) expanded to the full
 * `rdf:type` IRI.
 *
 * @param triple The triple to serialise, as a `[subject, predicate, object]` tuple
 *
 * @returns The generated triple
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#QSynTriples SPARQL 1.1 Triple Patterns}
 */
export function triple([subject, predicate, object]: Triple): SPARQL {
	return edge(
		term(subject),
		reference(predicate === "a" ? type : predicate),
		term(object)
	);
}


/**
 * Generates SPARQL triple patterns from a {@link Pattern} sequence.
 *
 * Renders each pattern as `subject predicate object .` and space-joins them, so the empty sequence yields the empty
 * string. {@link Variable} positions render as themselves and the predicate `"a"` shorthand is emitted verbatim.
 *
 * @param patterns The triple patterns to serialise
 *
 * @returns The generated triple patterns, space-joined, or the empty string for an empty sequence
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
 * {@link variable}; a non-variable subject renders as a {@link blank | blank node} or an IRI {@link reference}; the
 * predicate renders as an IRI {@link reference}, or verbatim for the `"a"`
 * ({@link https://www.w3.org/TR/sparql11-query/#abbrevRdfType SPARQL `rdf:type` shorthand}); a non-variable object
 * renders as any {@link term}.
 *
 * @param pattern The triple pattern to serialise, as a `[subject, predicate, object]` tuple
 *
 * @returns The generated triple pattern
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#QSynTriples SPARQL 1.1 Triple Patterns}
 */
export function pattern([subject, predicate, object]: Pattern): SPARQL {
	return edge(
		isVariable(subject) ? variable(subject) : term(subject),
		isVariable(predicate) ? variable(predicate) : predicate === "a" ? "a" : reference(predicate),
		isVariable(object) ? variable(object) : term(object)
	);
}


/**
 * Generates the SPARQL representation of a {@link Variable} or {@link Term}.
 *
 * Dispatches to {@link variable} for a query variable and to {@link term} for any RDF term, serialising a node that
 * occupies a subject or object position whether or not it is left unbound.
 *
 * @param anchor The query variable or RDF term to render
 *
 * @returns The generated SPARQL node
 */
export function anchor(anchor: Variable | Term): SPARQL {
	return isVariable(anchor) ? variable(anchor) : term(anchor);
}

/**
 * Generates the SPARQL representation of a {@link Variable}.
 *
 * The variable token is already its own SPARQL form (for example `?0`), so it is emitted verbatim.
 *
 * @param variable The variable token
 *
 * @returns The SPARQL variable
 */
export function variable(variable: Variable): SPARQL {
	return variable;
}


/**
 * Generates the SPARQL representation of a {@link Term}.
 *
 * Delegates to {@link blank} for blank nodes, {@link reference} for IRIs, and {@link literal} for
 * {@link Tagged | language-tagged} and {@link Typed | datatype-typed} literals; `literal` selects the tagged or typed
 * form based on the supplied language tag or datatype IRI.
 *
 * @param term The RDF term to render
 *
 * @returns The generated SPARQL term
 *
 * @remarks
 *
 * Renders SPARQL query text and is distinct from the same-named `term` constructor in the package entry module, which
 * mints an RDF {@link Term} value. The companion serialisers {@link tagged} and {@link typed} shadow their value
 * constructors the same way.
 */
export function term(term: Term): SPARQL {
	return isBlankValue(term) ? blank(term)
		: isReference(term) ? reference(term)
			: literal(term.text, isTagged(term) ? term.language : term.datatype);
}

/**
 * Generates the SPARQL representation of a {@link Blank | blank node}.
 *
 * The blank-node label is already its own SPARQL form (for example `_:0`), so it is emitted verbatim. When omitted,
 * mints a fresh `crypto.randomUUID()` label so the node stays distinct within the generated fragment.
 *
 * @param blank The blank-node label, or omitted to mint a fresh anonymous label
 *
 * @returns The generated blank node
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#QSynBlankNodes SPARQL 1.1 Blank Nodes}
 */
export function blank(blank?: Blank): SPARQL {
	return blank ?? `_:${crypto.randomUUID()}`;
}

/**
 * Generates the SPARQL IRIREF for an IRI {@link Reference}.
 *
 * Wraps the IRI in angle brackets and escapes characters forbidden by the IRIREF production. If no `reference` is
 * supplied, mints a fresh opaque `urn:uuid:` IRI via `crypto.randomUUID()`; useful for one-shot anonymous
 * resource anchors in generated SPARQL.
 *
 * @param reference The IRI, or omitted to mint a fresh `urn:uuid:` IRI
 *
 * @returns The generated IRIREF
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#rIRIREF SPARQL 1.1 IRIREF}
 */
export function reference(reference?: Reference): SPARQL {
	return `<${reference ? escapeIRI(reference) : `urn:uuid:${crypto.randomUUID()}`}>`;
}

/**
 * Generates the SPARQL representation of a boolean value.
 *
 * Emits the SPARQL boolean keyword `true` or `false`, the shorthand syntax for an `xsd:boolean` literal, rather than
 * the verbose `"true"^^xsd:boolean` typed form.
 *
 * @param value The boolean value to render
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
 * @param value The numeric value to render
 *
 * @returns The generated numeric literal
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#QSynLiterals SPARQL 1.1 RDF Term Syntax}
 */
export function number(value: number): SPARQL {
	return Number.isFinite(value) ? String(value)
		: typed(Number.isNaN(value) ? "NaN" : value > 0 ? "INF" : "-INF", xsd.double);
}

/**
 * Generates the SPARQL representation of a string value.
 *
 * Emits a simple literal in double quotes, escaping the content according to the N-Triples STRING_LITERAL_QUOTE
 * production; equivalent to {@link literal} called without a datatype.
 *
 * @param value The string value to render
 *
 * @returns The generated simple literal
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-STRING_LITERAL_QUOTE N-Triples STRING_LITERAL_QUOTE}
 */
export function string(value: string): SPARQL {
	return `"${escapeString(value)}"`;
}

/**
 * Generates the SPARQL representation of a literal value.
 *
 * Without a `type` (or with the redundant `xsd:string` datatype), produces a simple literal in double quotes. With a
 * {@link Tag}, produces a language-tagged literal. With any other {@link Reference}, produces a datatype-annotated
 * literal. String content is escaped according to the N-Triples STRING_LITERAL_QUOTE production.
 *
 * @param text The lexical value of the literal
 * @param type The language tag or datatype IRI, or omitted for a simple literal
 *
 * @returns The generated literal
 *
 * @see {@link boolean}
 * @see {@link number}
 * @see {@link string}
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-STRING_LITERAL_QUOTE N-Triples STRING_LITERAL_QUOTE}
 */
export function literal(text: string, type?: Tag | Reference): SPARQL {
	return isTag(type) ? tagged(text, type)
		: type !== undefined && type !== xsd.string ? typed(text, type)
			: `"${escapeString(text)}"`;
}

/**
 * Generates a language-tagged RDF literal.
 *
 * Emits the N-Triples form `"text"@language`, escaping `text` according to the STRING_LITERAL_QUOTE production.
 *
 * @param text The lexical value of the literal
 * @param language The BCP 47 language tag
 *
 * @returns The generated language-tagged literal
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-literal N-Triples literal production}
 */
export function tagged(text: string, language: Tag): SPARQL {
	return `"${escapeString(text)}"@${language}`;
}

/**
 * Generates a datatype-annotated RDF literal.
 *
 * Emits the N-Triples form `"text"^^<datatype>`, escaping `text` according to the STRING_LITERAL_QUOTE production
 * and the IRI according to the IRIREF production.
 *
 * @param text The lexical value of the literal
 * @param datatype The IRI identifying the literal's datatype
 *
 * @returns The generated datatype-annotated literal
 *
 * @remarks
 *
 * Renders SPARQL query text, distinct from the same-named `typed` constructor in the package entry module that mints
 * an RDF value.
 *
 * @see {@link https://www.w3.org/TR/n-triples/#grammar-production-literal N-Triples literal production}
 */
export function typed(text: string, datatype: Reference): SPARQL {
	return `"${escapeString(text)}"^^${reference(datatype)}`;
}
