import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { userMemory, userProfiles } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import type { Tier } from "./classifier";
import { promptVersion } from "./prompt-version";

// Prompt fragments are bundled at build time, not read from disk at runtime.
// See next.config.ts for why. Adding a fragment means adding an import here.
import systemPrompt from "@/lib/layer2/system-prompt.md";
import miOverview from "@/lib/layer3/mi-overview.md";
import tier1Protocol from "@/lib/layer3/tier-1-protocol.md";
import tier2Protocol from "@/lib/layer3/tier-2-protocol.md";
import tier3Protocol from "@/lib/layer3/tier-3-protocol.md";
import crisisResources from "@/lib/layer3/crisis-resources.md";

type ProfileShape = {
  tendencies?: string;
  goals?: string;
  background?: string;
};

const KIND_LABELS: Record<string, string> = {
  fact: "Facts",
  thread: "Open threads",
  preference: "Preferences",
  diagnostic_context: "Diagnostic context",
  other: "Other",
};

export type Layer4Context = {
  /** The assembled Layer 4 block. Empty string when there is nothing to include. */
  text: string;
  /** Metadata for per-call logging. Counts and kinds only — never content. */
  memoryCount: number;
  memoryKinds: string[];
  hasProfile: boolean;
};

export async function buildLayer4Context(userId: string): Promise<Layer4Context> {
  // Fetch active confirmed memory entries
  const memories = await db
    .select()
    .from(userMemory)
    .where(
      and(
        eq(userMemory.userId, userId),
        eq(userMemory.isActive, true),
        isNotNull(userMemory.lastConfirmedAt)
      )
    );

  // Fetch user profile
  const [profileRow] = await db
    .select({ encryptedContent: userProfiles.encryptedContent })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  // Layer 4 fails closed.
  //
  // These used to swallow decrypt errors and continue, which meant a key problem
  // produced a confident-sounding response generated without the user's profile
  // or memory — silently, with nothing in the logs and no way for the user to
  // tell. For journal content that is a worse outcome than an error: the model
  // would be reasoning about someone it had just been told nothing about.
  const profileParts: string[] = [];
  if (profileRow?.encryptedContent) {
    try {
      const profile = JSON.parse(decrypt(profileRow.encryptedContent)) as ProfileShape;
      if (profile.tendencies) profileParts.push(`Tendencies: ${profile.tendencies}`);
      if (profile.goals) profileParts.push(`Goals: ${profile.goals}`);
      if (profile.background) profileParts.push(`Background: ${profile.background}`);
    } catch (err) {
      console.error(
        `Layer 4: profile decrypt/parse failed for user ${userId}:`,
        err instanceof Error ? err.message : err
      );
      throw new Error("Layer 4 context could not be assembled: profile unreadable");
    }
  }

  const memoryByKind = new Map<string, string[]>();
  for (const entry of memories) {
    try {
      const content = decrypt(entry.encryptedContent);
      const list = memoryByKind.get(entry.kind) ?? [];
      list.push(content);
      memoryByKind.set(entry.kind, list);
    } catch (err) {
      console.error(
        `Layer 4: memory decrypt failed for entry ${entry.id} (user ${userId}):`,
        err instanceof Error ? err.message : err
      );
      throw new Error("Layer 4 context could not be assembled: memory unreadable");
    }
  }

  const hasProfile = profileParts.length > 0;
  const hasMemory = memoryByKind.size > 0;

  const stats = {
    memoryCount: [...memoryByKind.values()].reduce((n, list) => n + list.length, 0),
    memoryKinds: [...memoryByKind.keys()],
    hasProfile,
  };

  if (!hasProfile && !hasMemory) return { text: "", ...stats };

  const sections: string[] = ["## User context (Layer 4)"];

  if (hasProfile) {
    sections.push("### Profile\n" + profileParts.join("\n"));
  }

  if (hasMemory) {
    const memoryLines: string[] = ["### Memory"];
    for (const [kind, items] of memoryByKind) {
      const label = KIND_LABELS[kind] ?? kind;
      memoryLines.push(`**${label}:**`);
      for (const item of items) {
        memoryLines.push(`- ${item}`);
      }
    }
    sections.push(memoryLines.join("\n"));
  }

  return { text: sections.join("\n\n"), ...stats };
}

// Fragment registry — keeps each fragment's identity attached to its body so the
// name and version can be reported without a second lookup.
const LAYER_2 = { name: "layer2/system-prompt.md", body: systemPrompt };

const LAYER_3 = {
  mi: { name: "layer3/mi-overview.md", body: miOverview },
  tier1: { name: "layer3/tier-1-protocol.md", body: tier1Protocol },
  tier2: { name: "layer3/tier-2-protocol.md", body: tier2Protocol },
  tier3: { name: "layer3/tier-3-protocol.md", body: tier3Protocol },
  crisis: { name: "layer3/crisis-resources.md", body: crisisResources },
} as const;

export type ComposedPrompt = {
  prompt: string;
  layer2Version: string;
  layer3Fragments: { name: string; version: string }[];
};

export function buildSystemPrompt(tier: Tier, layer4 = ""): ComposedPrompt {
  const fragments: { name: string; body: string }[] = [LAYER_3.mi];

  if (tier === 1) fragments.push(LAYER_3.tier1);
  if (tier === 2) fragments.push(LAYER_3.tier2, LAYER_3.crisis);
  if (tier === 3) fragments.push(LAYER_3.tier3, LAYER_3.crisis);

  const parts = [LAYER_2.body, ...fragments.map((f) => f.body)];
  if (layer4) parts.push(layer4);

  return {
    prompt: parts.join("\n\n---\n\n"),
    layer2Version: promptVersion(LAYER_2.body),
    layer3Fragments: fragments.map((f) => ({
      name: f.name,
      version: promptVersion(f.body),
    })),
  };
}

/**
 * Per-call record of what went into the prompt.
 *
 * Planning doc, "Layer architecture in code": "The orchestrator should log which
 * Layer 3 fragments and which Layer 4 items were included in each call, for
 * debugging and refinement."
 *
 * Metadata only. Never prompt bodies, never memory or profile content, never the
 * user's message. Memory is reported as a count and a list of kinds.
 */
export function logPromptComposition(input: {
  call: "reflection" | "closing";
  reflectionId: string;
  tier: Tier;
  composed: ComposedPrompt;
  layer4: Layer4Context;
  historyEntries: number;
}) {
  console.log(
    JSON.stringify({
      event: "prompt_composition",
      call: input.call,
      reflectionId: input.reflectionId,
      tier: input.tier,
      layer2: input.composed.layer2Version,
      // Objects, not "name@version" strings — the version already contains an
      // "@" (e.g. "v1@2026-05-06"), so concatenating produced "file.md@v1@date".
      layer3: input.composed.layer3Fragments.map((f) => ({
        fragment: f.name,
        version: f.version,
      })),
      layer4: {
        memoryCount: input.layer4.memoryCount,
        memoryKinds: input.layer4.memoryKinds,
        hasProfile: input.layer4.hasProfile,
      },
      historyEntries: input.historyEntries,
    })
  );
}
