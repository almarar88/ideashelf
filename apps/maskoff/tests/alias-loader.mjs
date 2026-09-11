/**
 * Resolver for `node --test`:
 *   - maps the app's "@/" and "@shared/" path aliases
 *   - appends ".ts" to extensionless relative imports
 *
 * This lets the suite import the exact modules the bundler does, rather than
 * testing a re-pathed copy of them.
 */
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";
import { existsSync } from "node:fs";

const ROOT = resolvePath(import.meta.dirname, "..");
const ALIASES = [
  ["@shared/", `${ROOT}/supabase/functions/_shared/`],
  ["@/", `${ROOT}/src/`],
];

const withTs = (path) => (/\.[a-z]+$/i.test(path) ? path : `${path}.ts`);

export function resolve(specifier, context, next) {
  for (const [prefix, target] of ALIASES) {
    if (specifier.startsWith(prefix)) {
      return next(pathToFileURL(withTs(`${target}${specifier.slice(prefix.length)}`)).href, context);
    }
  }

  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier) && context.parentURL) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(candidate)) return next(candidate.href, context);
  }

  return next(specifier, context);
}
