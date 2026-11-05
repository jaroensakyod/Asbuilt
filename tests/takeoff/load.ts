// Test loader: lets node --test --experimental-strip-types import the takeoff and house libs, whose relative imports
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

/** Import a module under src/lib by path, e.g. lib("takeoff/calc"). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const lib = (name: string): Promise<any> => import(new URL(`../../src/lib/${name}.ts`, import.meta.url).href);
/** The demo project list (src/lib/data.ts has no imports). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const demoData = (): Promise<any> => import(new URL(`../../src/lib/data.ts`, import.meta.url).href);
