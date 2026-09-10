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

import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { defineConfig } from "vitest/config";

const packages = join(__dirname, "packages");

/**
 * Locates a `wire*` workspace package within its query-language group directory.
 *
 * Packages are grouped one level below `packages/` (for example `packages/sparql/wire-sparql`), so the group segment is
 * discovered by scanning the immediate subdirectories of `packages/` for one that contains the package.
 *
 * @param pkg - The package directory name (for example `wire-sparql`)
 *
 * @returns The absolute path to the package directory, or `null` if no group contains it
 */
function locate(pkg: string): string | null {

	const group = readdirSync(packages, { withFileTypes: true })
		.filter(entry => entry.isDirectory())
		.find(entry => existsSync(join(packages, entry.name, pkg)));

	return group ? join(packages, group.name, pkg) : null;

}

export default defineConfig({

	test: {

		/**
		 * Allows workspace packages without test files to pass cleanly during `npm run check --workspaces`.
		 */
		passWithNoTests: true,

		typecheck: {
			include: ["**/src/**/*.test-d.ts"],
			tsconfig: "packages/sparql/wire-sparql/tsconfig.json"
		}

	},

	plugins: [{

		name: "wire-resolver",
		enforce: "pre",

		/**
		 * Resolves `@metreeca/wire*` workspace imports to TypeScript source for build-free testing.
		 *
		 * - `@metreeca/wire-pkg` → `packages/<group>/wire-pkg/src/index.ts`
		 * - `@metreeca/wire-pkg/module` → `packages/<group>/wire-pkg/src/module.ts` or
		 * `packages/<group>/wire-pkg/src/module/index.ts`
		 *
		 * @param id - The module specifier to resolve
		 *
		 * @returns The resolved file path, or `null` if the specifier does not match
		 */
		resolveId(id: string) {

			const bare = id.match(/^@metreeca\/(wire[^/]*)$/);

			if ( bare ) { // bare package import

				const base = locate(bare[1]);

				return base ? join(base, "src", "index.ts") : null;

			} else { // subpath import

				const module = id.match(/^@metreeca\/(wire[^/]*)\/(.+)$/);

				if ( module ) {

					const base = locate(module[1]);

					if ( base ) {

						const named = join(base, "src", `${module[2]}.ts`);
						const index = join(base, "src", module[2], "index.ts");

						return existsSync(named) ? named
							: existsSync(index) ? index
								: null;

					} else {

						return null;

					}

				} else {

					return null;

				}

			}

		}

	}]

});
