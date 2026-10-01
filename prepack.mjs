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

/*
 * Collapses each `exports` entry of the package being packed to its `default` target, so the published manifest
 * never points consumers requesting the `@metreeca/source` condition at sources missing from the tarball.
 *
 * Runs in CI only: the manifest is rewritten in place and never restored.
 */

import { readFileSync, writeFileSync } from "node:fs";

const manifest = "package.json";

if ( process.env.CI ) {

	const pkg = JSON.parse(readFileSync(manifest, "utf8"));

	writeFileSync(manifest, `${JSON.stringify({
		...pkg,
		exports: Object.fromEntries(Object.entries(pkg.exports).map(([path, target]) =>
			[path, typeof target === "string" ? target : target.default]
		))
	}, null, 2)}\n`);

}
