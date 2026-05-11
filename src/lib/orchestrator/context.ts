import { readFileSync } from "fs";
import { join } from "path";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { userMemory, userProfiles } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import type { Tier } from "./classifier";

function l2(filename: string) {
  return readFileSync(join(process.cwd(), "src/lib/layer2", filename), "utf-8");
}

function l3(filename: string) {
  return readFileSync(join(process.cwd(), "src/lib/layer3", filename), "utf-8");
}

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

export async function buildLayer4Context(userId: string): Promise<string> {
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

  const profileParts: string[] = [];
  if (profileRow?.encryptedContent) {
    try {
      const profile = JSON.parse(decrypt(profileRow.encryptedContent)) as ProfileShape;
      if (profile.tendencies) profileParts.push(`Tendencies: ${profile.tendencies}`);
      if (profile.goals) profileParts.push(`Goals: ${profile.goals}`);
      if (profile.background) profileParts.push(`Background: ${profile.background}`);
    } catch {
      // Decrypt or parse failure — omit profile silently
    }
  }

  const memoryByKind = new Map<string, string[]>();
  for (const entry of memories) {
    try {
      const content = decrypt(entry.encryptedContent);
      const list = memoryByKind.get(entry.kind) ?? [];
      list.push(content);
      memoryByKind.set(entry.kind, list);
    } catch {
      // Decrypt failure — skip this entry
    }
  }

  const hasProfile = profileParts.length > 0;
  const hasMemory = memoryByKind.size > 0;

  if (!hasProfile && !hasMemory) return "";

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

  return sections.join("\n\n");
}

export function buildSystemPrompt(tier: Tier, layer4 = ""): string {
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

  if (layer4) parts.push(layer4);

  return parts.join("\n\n---\n\n");
}
