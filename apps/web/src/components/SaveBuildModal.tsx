import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import { LoginModal } from '#/components/LoginModal';
import { useAuth } from '#/lib/auth';
import type { BuildConfig, BuildSummary } from '#/lib/builds';
import { buildShareUrl, createBuild } from '#/lib/builds';

type SaveBuildModalProps = {
  /** Snapshot the current build at save time. */
  getConfig: () => BuildConfig;
  /** The save this build was built on (sets build.save_id); null for free builds. */
  saveId: string | null;
  /** Called with the new build after a successful save. */
  onSaved: (build: BuildSummary) => void;
  onClose: () => void;
};

/**
 * Save the current build. Logged out, it prompts to log in (the build is not
 * lost meanwhile); logged in, it takes a name, saves to Supabase, and shows the
 * shareable link.
 */
export function SaveBuildModal({ getConfig, saveId, onSaved, onClose }: SaveBuildModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('My First Build');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const build = await createBuild(name.trim() || 'My Build', getConfig(), saveId);
      setShareUrl(buildShareUrl(build.shortLink));
      onSaved(build);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      // Clipboard may be blocked; the link is shown for manual copy.
    }
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
        aria-label="Close"
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
        <h2 className="text-lg font-semibold text-pale-mocha">Save build</h2>

        {shareUrl ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-pale-mocha">Build saved. Share it with this link:</p>
            <input
              readOnly
              value={shareUrl}
              onFocus={(event) => event.currentTarget.select()}
              className="w-full rounded-md border border-black-wool bg-black-wool px-3 py-2 text-sm text-pale-mocha"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={copy}
                className="cursor-pointer rounded-md bg-tamarillo px-4 py-2 text-sm font-semibold text-pale-mocha transition-colors hover:bg-old-red"
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer text-sm text-au-chico underline transition-colors hover:text-pale-mocha"
              >
                Done
              </button>
            </div>
          </div>
        ) : user ? (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-au-chico">Build name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-md border border-black-wool bg-black-wool px-3 py-2 text-sm text-pale-mocha"
              />
            </label>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="w-full cursor-pointer rounded-md bg-tamarillo px-4 py-2 text-sm font-semibold text-pale-mocha transition-colors hover:bg-old-red disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save build'}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-pale-mocha">
              Log in to save builds permanently. Your build stays here in the meantime.
            </p>
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="w-full cursor-pointer rounded-md bg-tamarillo px-4 py-2 text-sm font-semibold text-pale-mocha transition-colors hover:bg-old-red"
            >
              Log in
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </motion.div>

      <AnimatePresence>{showLogin && <LoginModal onClose={() => setShowLogin(false)} />}</AnimatePresence>
    </motion.div>
  );
}
