import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep API routes separable from page routes for future mobile client compatibility.
  // All business logic lives in src/lib/ — route handlers are thin wrappers.
  allowedDevOrigins: ["192.168.86.36"],

  // Import Layer 2 / Layer 3 prompt fragments (.md) as strings.
  //
  // These were previously loaded with readFileSync(join(process.cwd(), ...)) using a
  // RUNTIME VARIABLE filename. That works locally and fails on Vercel: the file tracer
  // cannot follow a variable path, so the .md files were never bundled into the
  // serverless function, and process.cwd() there is the function root, not the repo
  // root. The first /api/chat request would have thrown ENOENT.
  //
  // As static imports the prompts join the module graph, so a missing or renamed
  // fragment is a build error rather than a production 500.
  //
  // NOTE: this is a webpack rule. Nothing in package.json runs Turbopack today. If
  // `--turbopack` is ever added to a script, mirror this with a `turbopack.rules`
  // entry (which additionally requires installing `raw-loader`), or the prompts will
  // fail to resolve under that bundler only.
  webpack: (config) => {
    config.module.rules.push({
      test: /\.md$/,
      type: "asset/source",
    });
    return config;
  },
};

export default nextConfig;
