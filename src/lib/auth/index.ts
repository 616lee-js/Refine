import { compare } from "bcryptjs";
import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export interface SessionData {
  userId?: string;
}

const SESSION_OPTIONS = {
  password: env.sessionSecret,
  cookieName: "refine_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
}

export async function verifyPassphrase(input: string): Promise<boolean> {
  return compare(input, env.authPassphraseHash);
}
