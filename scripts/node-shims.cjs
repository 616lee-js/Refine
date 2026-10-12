/**
 * Two things the Next build provides and plain Node does not.
 *
 * Any script that imports application code deep enough reaches one of these and
 * dies on it. `scripts/mirror-run-once.ts` imports `src/lib/mirror/review.ts`,
 * which hits both, so it could not run at all between 2026-10-12 and this file
 * existing — the failure is `Cannot find module 'server-only'` and it happens at
 * load, before anything useful has run.
 *
 *   1. `server-only` — a marker package that exists to make a build fail if a
 *      module is imported from the browser. It has no runtime behaviour. Next
 *      ships an empty module for exactly this purpose and that is what it
 *      resolves to here.
 *
 *   2. `.md` imports — the Layer 2 and Layer 3 prompts are markdown files
 *      imported as strings. Next's bundler turns them into modules; Node has no
 *      idea what a `.md` file is, so one is registered that returns the text.
 *
 * Both patches CHAIN rather than replace: tsx installs its own resolver and
 * calls through to whatever was there before, so this must do the same or tsx's
 * TypeScript and path-alias handling stops working.
 *
 * Loaded with `--require ./scripts/node-shims.cjs` before `--import tsx`.
 */

/*
 * `require` is not a style choice here. Node loads --require files as CommonJS,
 * before any ES module loader exists, which is the only point early enough to
 * patch module resolution for everything that follows.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const Module = require("module");
const fs = require("fs");

const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") {
    return require.resolve("next/dist/compiled/server-only/empty.js");
  }
  return resolve.call(this, request, ...rest);
};

Module._extensions[".md"] = function (module, filename) {
  // `module.exports = string` is what a default import of a markdown file gets,
  // matching how the bundler exposes it.
  module.exports = fs.readFileSync(filename, "utf8");
};
