// Test loader: lets node --test --experimental-strip-types import the ai-sales libs, whose relative imports
// have no ".ts" extension (the Next.js bundler resolves them; plain Node does not).
import * as nodeModule from "node:module";

type Next = (specifier: string, context?: unknown) => unknown;
const hooks = nodeModule as unknown as { registerHooks: (h: { resolve: (s: string, c: unknown, next: Next) => unknown }) => void };
hooks.registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (err) {
      if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) return next(specifier + ".ts", context);
      throw err;
    }
  },
});

/** Import a module under src/lib/ai-sales by file name, e.g. lib("journal"). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const lib = (name: string): Promise<any> => import(new URL(`../../src/lib/ai-sales/${name}.ts`, import.meta.url).href);
