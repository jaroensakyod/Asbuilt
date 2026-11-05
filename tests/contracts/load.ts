// Test loader: lets node --test --experimental-strip-types import the accounting libs, whose relative imports
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

/** Import a module under src/lib/contracts by file name, e.g. lib("calc"). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const lib = (name: string): Promise<any> => import(new URL(`../../src/lib/contracts/${name}.ts`, import.meta.url).href);
/** Import a module under src/lib by path, e.g. src("accounting/journal"). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const src = (path: string): Promise<any> => import(new URL(`../../src/lib/${path}.ts`, import.meta.url).href);
