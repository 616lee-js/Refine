/**
 * Layer 2 and Layer 3 prompt fragments are authored as .md and imported as
 * strings. The webpack rule in next.config.ts (`type: "asset/source"`) turns
 * each import into the file's raw contents.
 *
 * Prompts are deliberately NOT read from disk at runtime — see the comment in
 * next.config.ts for why that broke on Vercel.
 */
declare module "*.md" {
  const content: string;
  export default content;
}
