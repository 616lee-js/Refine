import { AdminNav } from "@/components/ui/admin-nav";
import { ProfileForm } from "./profile-form";

/**
 * A server shell around the client form, purely so the admin nav can be
 * computed server-side — see components/ui/admin-nav.tsx.
 */
export default function ProfileSettingsPage() {
  return <ProfileForm admin={<AdminNav />} />;
}
