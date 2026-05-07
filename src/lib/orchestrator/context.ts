import { readFileSync } from "fs";
import { join } from "path";
import type { Tier } from "./classifier";

function l2(filename: string) {
  return readFileSync(join(process.cwd(), "src/lib/layer2", filename), "utf-8");
}

function l3(filename: string) {
  return readFileSync(join(process.cwd(), "src/lib/layer3", filename), "utf-8");
}

export function buildSystemPrompt(tier: Tier): string {
  const parts = [l2("system-prompt.md"), l3("mi-overview.md")];

  if (tier === 1) parts.push(l3("tier-1-protocol.md"));
  if (tier === 2) {
    parts.push(l3("tier-2-protocol.md"));
    parts.push(l3("crisis-resources.md"));
  }
  if (tier === 3) {
    parts.push(l3("tier-3-protocol.md"));
    parts.push(l3("crisis-resources.md"));
  }

  return parts.join("\n\n---\n\n");
}
