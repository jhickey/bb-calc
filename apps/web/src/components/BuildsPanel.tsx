import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import type { BuildSummary } from '#/lib/builds';
import { buildShareUrl } from '#/lib/builds';

type BuildsPanelProps = {
  builds: Array<BuildSummary>;
  /** Load a build into the editor. */
  onLoad: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  className?: string;
};

/** The Builds tab: the user's saved builds, each loadable/renamable/shareable. */
export function BuildsPanel({ builds, onLoad, onRename, onDelete, className = '' }: BuildsPanelProps) {
  if (builds.length === 0) {
    return (
      <p className={`text-sm text-au-chico ${className}`}>
        No builds yet. Build something on the Weapons tab and click “Save build”.
      </p>
    );
  }

  return (
    <ul className={`space-y-2 ${className}`}>
      <AnimatePresence initial={false}>
        {builds.map((build) => (
          <BuildRow key={build.id} build={build} onLoad={onLoad} onRename={onRename} onDelete={onDelete} />
        ))}
      </AnimatePresence>
    </ul>
  );
}

function BuildRow({
  build,
  onLoad,
  onRename,
  onDelete,
}: {
  build: BuildSummary;
  onLoad: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(build.name);
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(buildShareUrl(build.shortLink));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be blocked.
    }
  }

  function commitRename() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== build.name) onRename(build.id, trimmed);
    setEditing(false);
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 rounded-md border border-black-wool bg-black-wool/40 p-3"
    >
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitRename();
            if (event.key === 'Escape') {
              setName(build.name);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 rounded-sm border border-black-wool bg-black-wool px-2 py-1 text-sm text-pale-mocha"
        />
      ) : (
        <button
          type="button"
          onClick={() => onLoad(build.id)}
          className="min-w-0 flex-1 cursor-pointer truncate text-left font-semibold text-pale-mocha"
        >
          {build.name}
        </button>
      )}

      <div className="flex shrink-0 items-center gap-3 text-xs">
        <button
          type="button"
          onClick={copyLink}
          className="cursor-pointer text-au-chico underline transition-colors hover:text-pale-mocha"
        >
          {copied ? 'Copied' : 'Share'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="cursor-pointer text-au-chico underline transition-colors hover:text-pale-mocha"
        >
          Rename
        </button>
        {confirmingDelete ? (
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDelete(build.id)}
              className="cursor-pointer font-semibold text-red-400 underline transition-colors hover:text-red-300"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="cursor-pointer text-au-chico underline transition-colors hover:text-pale-mocha"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Delete ${build.name}`}
            title="Delete build"
            className="cursor-pointer text-xl leading-none text-au-chico transition-colors hover:text-red-400"
          >
            ×
          </button>
        )}
      </div>
    </motion.li>
  );
}
