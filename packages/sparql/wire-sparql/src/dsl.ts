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
 * DSL for SPARQL queries.
 *
 * Provides composable combinators that assemble SPARQL query strings from typed fragments: graph patterns, property
 * paths, expressions, aggregates, solution modifiers, and the serialisers that render RDF {@link Term | terms} into
 * their SPARQL lexical forms. Every combinator takes and returns {@link SPARQL} fragments, so clauses nest by
 * ordinary function composition into a complete query.
 *
 * @module
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/ SPARQL 1.1 Query Language}
 * @see {@link https://www.w3.org/TR/rdf11-concepts/ RDF 1.1 Concepts}
 * @see {@link https://www.w3.org/TR/n-triples/ RDF 1.1 N-Triples}
 */

import { type Identifier } from "@metreeca/core";
import { isTag, type Tag, type TagRange } from "@metreeca/core/language";
import { escapeIRI, escapeString } from "./dsl.core.js";
import {
	type Blank,
	isBlank as isBlankValue,
	isReference,
	isTagged,
	isVariable,
	type Pattern,
	rdf,
	type Reference,
	type SPARQL,
	type Term,
	type Triple,
	type Variable,
	xsd
} from "./index.js";


/**
 * Generates a SPARQL `UNION` pattern.
 *
 * A single clause is returned as-is; multiple clauses are wrapped in {@link group | groups} and joined with `union`.
 * An empty list yields the empty fragment via {@link nil}, which callers must guard against where a pattern is
 * required.
 *
 * @param clauses The graph pattern clauses to combine
 *
 * @returns The SPARQL `UNION` pattern
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#alternatives SPARQL 1.1 Alternative Patterns}
 */
export function union(...clauses: readonly SPARQL[]): SPARQL {
	return clauses.length === 0 ? nil()
		: clauses.length === 1 ? clauses[0]
			: clauses.map(clause => group(clause)).join(" union ");
}

/**
 * Generates a SPARQL `OPTIONAL` group pattern.
 *
 * Wraps the clauses in an `optional` group; an empty list yields an empty `optional { }` group, which callers must
 * guard against where a matching pattern is required.
 *
 * @param clauses The graph pattern clauses to wrap
 *
 * @returns The SPARQL `OPTIONAL` group pattern
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#optionals SPARQL 1.1 Optional Patterns}
 */
export function optional(...clauses: readonly SPARQL[]): SPARQL {
	return `optional { ${fragment(...clauses)} }`;
}

/**
 * Generates a SPARQL group graph pattern.
 *
 * @param clauses The graph pattern clauses to wrap
 *
 * @returns The braced SPARQL group pattern
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#GroupPatterns SPARQL 1.1 Group Graph Patterns}
 */
export function group(...clauses: readonly SPARQL[]): SPARQL {
	return `{ ${fragment(...clauses)} }`;
}

/**
 * Generates a SPARQL `MINUS` pattern.
 *
 * Wraps the clauses in a `minus` group, removing from the enclosing group every solution compatible with the wrapped
 * pattern. An empty list yields an empty `minus { }` group, which callers must guard against where a pattern is
 * required.
 *
 * @param clauses The graph pattern clauses to subtract
 *
 * @returns The SPARQL `MINUS` pattern
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#negation SPARQL 1.1 Negation}
 */
export function minus(...clauses: readonly SPARQL[]): SPARQL {
	return `minus { ${fragment(...clauses)} }`;
}

/**
 * Generates a SPARQL `GRAPH` block scoping patterns to a named graph.
 *
 * Wraps the clauses in a `graph` block matched against the graph named by `name`, a {@link Variable} ranging over the
 * dataset's graph names or a fixed IRI {@link reference}. An empty list yields an empty `graph … { }` block.
 *
 * @param name The serialised graph name: a variable or an IRI reference
 * @param clauses The graph pattern clauses to scope
 *
 * @returns The SPARQL `GRAPH` block
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#queryDataset SPARQL 1.1 Querying the Dataset}
 */
export function graph(name: SPARQL, ...clauses: readonly SPARQL[]): SPARQL {
	return `graph ${name} { ${fragment(...clauses)} }`;
}

/**
 * Generates a SPARQL `SERVICE` block delegating patterns to a federated endpoint.
 *
 * Wraps the clauses in a `service` block evaluated against the remote SPARQL endpoint identified by `endpoint`, a
 * {@link Variable} or a fixed IRI {@link reference}. An empty list yields an empty `service … { }` block.
 *
 * @param endpoint The serialised endpoint: a variable or an IRI reference
 * @param clauses The graph pattern clauses to delegate
 *
 * @returns The SPARQL `SERVICE` block
 *
 * @see {@link https://www.w3.org/TR/sparql11-federated-query/#service SPARQL 1.1 Federated Query — SERVICE}
 */
export function service(endpoint: SPARQL, ...clauses: readonly SPARQL[]): SPARQL {
	return `service ${endpoint} { ${fragment(...clauses)} }`;
}

/**
 * Generates a SPARQL `VALUES` inline-data block.
 *
 * Binds the `variables` to each row of `rows` in turn, supplying inline solutions the enclosing pattern joins against.
 * Every row lists one value per variable, using the `undef` keyword for an unbound position. An empty row list yields
 * an empty `values (…) { }` block matching nothing.
 *
 * @param variables The serialised variables bound by the block
 * @param rows The value rows, each a list of serialised terms positionally aligned with `variables`
 *
 * @returns The SPARQL `VALUES` block
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#inline-data SPARQL 1.1 Inline Data}
 */
export function values(variables: readonly SPARQL[], rows: readonly (readonly SPARQL[])[]): SPARQL {
	return `values (${variables.join(" ")}) { ${rows.map(row => `(${row.join(" ")})`).join(" ")} }`;
}

/**
 * Generates a single {@link SPARQL} fragment by joining clauses.
 *
 * @param clauses The clauses to join
 *
 * @returns The space-joined fragment
 */
export function fragment(...clauses: readonly SPARQL[]): SPARQL {
	return clauses.join(" ");
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


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Generates a SPARQL sequence property path.
 *
 * Joins the path elements with `/`, matching nodes reached by following each element in turn. A sequence binds tighter
 * than an {@link alt | alternative}, so it nests inside one without parentheses; a single element is returned
 * unchanged.
 *
 * @param paths The path elements to chain, in traversal order
 *
 * @returns The `/`-joined sequence path
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#propertypaths SPARQL 1.1 Property Paths}
 */
export function seq(...paths: readonly SPARQL[]): SPARQL {
	return paths.join("/");
}

/**
 * Generates a SPARQL alternative property path.
 *
 * Joins the path elements with `|`, matching nodes reachable by any one of them. As the lowest-precedence path
 * operator, it admits {@link seq | sequences} as elements without parentheses; a single element is returned unchanged.
 *
 * @param paths The alternative path elements
 *
 * @returns The `|`-joined alternative path
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#propertypaths SPARQL 1.1 Property Paths}
 */
export function alt(...paths: readonly SPARQL[]): SPARQL {
	return paths.join("|");
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
 * reverse direction. A single predicate renders as `!pred`; several render as the parenthesised `!(a|b)` form.
 *
 * @param predicates The forbidden predicates, each an IRI reference or the inverse of one
 *
 * @returns The `!`-prefixed none property set
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#propertypaths SPARQL 1.1 Property Paths}
 */
export function none(...predicates: readonly SPARQL[]): SPARQL {
	return predicates.length === 1 ? `!${predicates[0]}`
		: `!(${predicates.join("|")})`;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
export function alias(expression: SPARQL, variable: SPARQL): SPARQL {
	return `(${expression} as ${variable})`;
}

/**
 * Generates a SPARQL `bind` clause, assigning a computed expression to a variable in the WHERE body.
 *
 * Introduces a new in-scope variable bound to the expression's value at the point the clause
 * appears, so subsequent patterns and filters can reference it. The projection-list counterpart,
 * naming a computed `select` column, is {@link alias}.
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
 * Generates a SPARQL `ORDER BY` clause.
 *
 * Prefixes the space-joined order conditions with `order by`. Each condition is a bare expression for ascending order
 * or an {@link asc} or {@link desc} wrapper. An empty list yields the empty fragment, leaving the solution sequence
 * unordered.
 *
 * @param conditions The order conditions, in priority order
 *
 * @returns The SPARQL `ORDER BY` clause, or the empty fragment for no conditions
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#modOrderBy SPARQL 1.1 Order By}
 */
export function orderBy(...conditions: readonly SPARQL[]): SPARQL {
	return conditions.length === 0 ? nil() : `order by ${fragment(...conditions)}`;
}

/**
 * Generates a SPARQL `GROUP BY` clause.
 *
 * Prefixes the space-joined grouping expressions with `group by`, partitioning solutions for aggregation. An empty list
 * yields the empty fragment, leaving the solutions ungrouped.
 *
 * @param expressions The grouping expressions
 *
 * @returns The SPARQL `GROUP BY` clause, or the empty fragment for no expressions
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#aggregates SPARQL 1.1 Aggregates}
 */
export function groupBy(...expressions: readonly SPARQL[]): SPARQL {
	return expressions.length === 0 ? nil() : `group by ${fragment(...expressions)}`;
}

/**
 * Generates a SPARQL `HAVING` constraint.
 *
 * Wraps the constraint in a `having(…)` clause, filtering grouped solutions by an aggregate condition the way
 * {@link filter} constrains ungrouped ones. Conjoin conditions with {@link and} to constrain on more than one.
 *
 * @param constraint The boolean constraint expression over the grouped solutions
 *
 * @returns The SPARQL `HAVING` constraint
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#aggregates SPARQL 1.1 Aggregates}
 */
export function having(constraint: SPARQL): SPARQL {
	return `having(${constraint})`;
}

/**
 * Generates a SPARQL `LIMIT` clause.
 *
 * @param count The maximum number of solutions to return
 *
 * @returns The SPARQL `LIMIT` clause
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#modResultLimit SPARQL 1.1 Limit}
 */
export function limit(count: number): SPARQL {
	return `limit ${count}`;
}

/**
 * Generates a SPARQL `OFFSET` clause.
 *
 * @param start The number of leading solutions to skip
 *
 * @returns The SPARQL `OFFSET` clause
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#modOffset SPARQL 1.1 Offset}
 */
export function offset(start: number): SPARQL {
	return `offset ${start}`;
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
 * Generates an empty {@link SPARQL} fragment.
 *
 * @returns The empty string
 */
export function nil(): SPARQL {
	return "";
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
 * fallback where an inner expression may be unbound or out of domain.
 *
 * @param expressions The candidate expressions, in priority order
 *
 * @returns The `coalesce(…)` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-coalesce SPARQL 1.1 coalesce}
 */
export function coalesce(...expressions: readonly SPARQL[]): SPARQL {
	return `coalesce(${expressions.join(", ")})`;
}

/**
 * Generates a SPARQL `str()` call rendering a term's lexical form as a plain literal.
 *
 * Drops the language tag or datatype of a literal and returns its lexical string; over an IRI it
 * returns the IRI string. A thin specialisation of {@link call}.
 *
 * @param expression The expression evaluating to the term to render
 *
 * @returns The `str()` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-str SPARQL 1.1 str}
 */
export function str(expression: SPARQL): SPARQL {
	return call("str", expression);
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
 * Generates a SPARQL function call from a function name and argument expressions.
 *
 * The generic primitive the named function builders ({@link str}, {@link datatype}, …) delegate to:
 * renders `fn(arg, …)` with the arguments comma-joined. The name is emitted verbatim, so the
 * caller upholds the lowercase generated-token convention.
 *
 * @param fn The SPARQL function name
 * @param args The argument expressions, in order
 *
 * @returns The `fn(…)` call
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#SparqlOps SPARQL 1.1 Function Library}
 */
export function call(fn: Identifier, ...args: readonly SPARQL[]): SPARQL {
	return `${fn}(${args.join(", ")})`;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
	return call("sum", expression);
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
	return call("min", expression);
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
	return call("max", expression);
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
	return call("avg", expression);
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
	return call("sample", expression);
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
	return separator === undefined ? `group_concat(${expression})`
		: `group_concat(${expression}; separator=${literal(separator)})`;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
 * nests inside an `or` without parentheses. A single operand is returned unchanged; an empty list
 * yields the empty fragment, which callers must guard against where a constraint is required.
 *
 * @param conditions The boolean expressions to conjoin
 *
 * @returns The `&&`-joined conjunction
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-logical-and SPARQL 1.1 Logical And}
 */
export function and(...conditions: readonly SPARQL[]): SPARQL {
	return conditions.join(" && ");
}

/**
 * Generates a SPARQL logical disjunction (`||`) of boolean expressions.
 *
 * Joins the operands with `||`, the lowest-precedence boolean operator, so {@link and} conjunctions
 * nest inside without parentheses. A single operand is returned unchanged; an empty list yields the
 * empty fragment, which callers must guard against where a constraint is required.
 *
 * @param conditions The boolean expressions to disjoin
 *
 * @returns The `||`-joined disjunction
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-logical-or SPARQL 1.1 Logical Or}
 */
export function or(...conditions: readonly SPARQL[]): SPARQL {
	return conditions.join(" || ");
}


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
 * Generates a SPARQL set-membership (`IN`) test.
 *
 * Evaluates to `true` when the expression equals any listed option under value comparison. An empty
 * option list renders `in ()`, which is always `false`, so callers that treat an empty set as
 * unconstrained must guard the call.
 *
 * @param expression The expression to test
 * @param options The candidate value expressions
 *
 * @returns The `… in (…)` membership test
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-in SPARQL 1.1 In}
 */
export function isIn(expression: SPARQL, options: readonly SPARQL[]): SPARQL {
	return `${expression} in (${options.join(", ")})`;
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
 * Generates a SPARQL `exists` graph-pattern test.
 *
 * Evaluates to `true` when the wrapped pattern has at least one solution in the enclosing context,
 * without binding any of its variables outward. The clauses are {@link fragment | space-joined} into
 * a single group.
 *
 * @param patterns The graph pattern clauses to test for a match
 *
 * @returns The `exists { … }` test
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-filter-exists SPARQL 1.1 Filter Exists}
 */
export function exists(...patterns: readonly SPARQL[]): SPARQL {
	return `exists { ${fragment(...patterns)} }`;
}

/**
 * Generates a SPARQL `not exists` graph-pattern test.
 *
 * The negation of {@link exists}: evaluates to `true` when the wrapped pattern has no solution in the
 * enclosing context. The clauses are {@link fragment | space-joined} into a single group.
 *
 * @param patterns The graph pattern clauses to test for absence
 *
 * @returns The `not exists { … }` test
 *
 * @see {@link https://www.w3.org/TR/sparql11-query/#func-filter-exists SPARQL 1.1 Filter Exists}
 */
export function nexists(...patterns: readonly SPARQL[]): SPARQL {
	return `not exists { ${fragment(...patterns)} }`;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
		reference(predicate === "a" ? rdf.type : predicate),
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
