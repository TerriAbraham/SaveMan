/**
 * Lets the API import the app's own TypeScript (booking rules, dummy data) from ../src, so both
 * enforce the same rules. Loaded with `node --import ./src/ts-paths.js`. Inside ../src it resolves
 * the app's `@/` alias and extensionless imports ('./dates' -> './dates.ts'), as Metro does.
 */
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';

const APP_SRC = new URL('../../src/', import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const parent = context.parentURL ?? '';
    let target;
    if (specifier.startsWith('@/')) target = new URL(specifier.slice(2), APP_SRC);
    else if (parent.startsWith(APP_SRC.href) && /^\.\.?\//.test(specifier)) target = new URL(specifier, parent);
    if (!target) return nextResolve(specifier, context);

    if (!/\.[cm]?[jt]s$/.test(target.pathname)) {
      const found = ['.ts', '/index.ts'].map((ext) => new URL(target.href + ext)).find((u) => existsSync(u));
      if (found) target = found;
    }
    return nextResolve(target.href, context);
  },
});
