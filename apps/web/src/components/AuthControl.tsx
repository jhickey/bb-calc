import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import { useAuth } from '#/lib/auth';

/**
 * Account control: a "Login" button (opening the login modal) when signed out,
 * or the signed-in email plus passkey-registration and logout actions.
 */
export function AuthControl() {
  const { user, loading, registerPasskey, signOut } = useAuth();
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
        <button
          type="button"
          onClick={addPasskey}
          className="cursor-pointer text-au-chico underline transition-colors hover:text-pale-mocha"
        >
          Add a passkey
        </button>
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

function LoginModal({ onClose }: { onClose: () => void }) {
  const { signInWithEmail, signInWithPasskey } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    setError(null);
    const { error } = await signInWithEmail(email.trim());
    if (error) {
      setError(error);
      setStatus('idle');
    } else {
      setStatus('sent');
    }
  }

  async function usePasskey() {
    setError(null);
    const { error } = await signInWithPasskey();
    if (error) setError(error);
    else onClose();
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <button
        type="button"
        aria-label="Close login"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/60"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-sm rounded-lg border border-black-wool bg-superhard p-6 shadow-xl"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <h2 className="text-lg font-semibold text-pale-mocha">Log in</h2>

        {status === 'sent' ? (
          <p className="mt-4 text-sm text-pale-mocha">
            Check <span className="font-semibold">{email}</span> for a one-time login link.
          </p>
        ) : (
          <form onSubmit={sendLink} className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-au-chico">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-md border border-black-wool bg-black-wool px-3 py-2 text-sm text-pale-mocha placeholder:text-au-chico"
              />
            </label>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full cursor-pointer rounded-md bg-tamarillo px-4 py-2 text-sm font-semibold text-pale-mocha transition-colors hover:bg-old-red disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'sending' ? 'Sending…' : 'Email me a login link'}
            </button>
          </form>
        )}

        <div className="my-4 flex items-center gap-3 text-xs text-au-chico">
          <span className="h-px flex-1 bg-black-wool" />
          or
          <span className="h-px flex-1 bg-black-wool" />
        </div>

        <button
          type="button"
          onClick={usePasskey}
          className="w-full cursor-pointer rounded-md border border-black-wool px-4 py-2 text-sm font-semibold text-pale-mocha transition-colors hover:border-tamarillo"
        >
          Sign in with a passkey
        </button>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </motion.div>
    </motion.div>
  );
}
