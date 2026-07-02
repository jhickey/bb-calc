import { useState } from 'react';
import { AnimatePresence } from 'motion/react';

import { LoginModal } from '#/components/LoginModal';
import { useAuth } from '#/lib/auth';

/**
 * Account control: a "Login" button (opening the login modal) when signed out,
 * or the signed-in email plus passkey-registration and logout actions.
 */
export function AuthControl() {
  const { user, loading, hasPasskey, registerPasskey, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (loading) return null;

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="cursor-pointer rounded-md bg-tamarillo px-4 py-2 text-sm font-semibold text-pale-mocha transition-colors hover:bg-old-red"
        >
          Login
        </button>
        <AnimatePresence>{open && <LoginModal onClose={() => setOpen(false)} />}</AnimatePresence>
      </>
    );
  }

  async function addPasskey() {
    setNotice(null);
    const { error } = await registerPasskey();
    setNotice(error ? `Couldn't add passkey: ${error}` : 'Passkey added.');
  }

  return (
    <div className="flex flex-col items-end gap-1 text-sm">
      <span className="text-au-chico">{user.email}</span>
      <div className="flex items-center gap-3">
        {hasPasskey === false && (
          <button
            type="button"
            onClick={addPasskey}
            className="cursor-pointer text-au-chico underline transition-colors hover:text-pale-mocha"
          >
            Add a passkey
          </button>
        )}
        <button
          type="button"
          onClick={() => signOut()}
          className="cursor-pointer text-au-chico underline transition-colors hover:text-pale-mocha"
        >
          Log out
        </button>
      </div>
      {notice && <span className="text-xs text-au-chico">{notice}</span>}
    </div>
  );
}
