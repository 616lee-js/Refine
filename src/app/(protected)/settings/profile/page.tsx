import { cookies } from "next/headers";
import { AdminNav } from "@/components/ui/admin-nav";
import {
  MODE_COOKIE,
  PALETTE_COOKIE,
  readMode,
  readPalette,
} from "@/lib/appearance";
import { ProfileForm } from "./profile-form";

/**
 * A server shell around the client form, so the admin nav can be computed
 * server-side — see components/ui/admin-nav.tsx — and so the appearance
 * controls start on the values actually in effect.
 *
 * Read from the same cookies the root layout paints from, not from the DOM.
 * Reading `document.documentElement.dataset` on the client would work until the
 * cookie and the attribute ever disagreed, and then the picker would show the
 * wrong option selected with nothing to explain why.
 */
export default async function ProfileSettingsPage() {
  const jar = await cookies();

  return (
    <ProfileForm
      admin={<AdminNav />}
      initialPalette={readPalette(jar.get(PALETTE_COOKIE)?.value)}
      initialMode={readMode(jar.get(MODE_COOKIE)?.value)}
    />
  );
}
