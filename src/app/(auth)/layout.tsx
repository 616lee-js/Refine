/**
 * Sign in and sign up are always Dawn, light.
 *
 * The root layout paints from cookies, which survive signing out — so without
 * this, someone who chose Slate dark would sign out and find the sign-in screen
 * still in Slate dark. That looks like the app remembering them after they asked
 * it not to.
 *
 * It is also the only appearance a new account has ever seen. Sign-up in one
 * palette and the first screen after it in another would be a change nobody
 * asked for, on the one screen where nothing is yet known about the person.
 *
 * `data-mode="light"` is set as well as the palette, so this holds even when the
 * cookie says `system` and the device is dark.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-palette="dawn" data-mode="light">
      {children}
    </div>
  );
}
