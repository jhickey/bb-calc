import { AnimatePresence, motion } from 'motion/react';

import type { SaveSummary } from '#/lib/saves';
import { formatPlaytime } from '#/lib/format';

type SavesPanelProps = {
  saves: Array<SaveSummary>;
  /** Load a save's inventory and return to the Weapons tab. */
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  className?: string;
};

/** The Saves tab: the user's uploaded saves, each loadable or deletable. */
export function SavesPanel({ saves, onLoad, onDelete, className = '' }: SavesPanelProps) {
  if (saves.length === 0) {
    return (
      <p className={`text-sm text-au-chico ${className}`}>
        No saves yet. Import a save above and it’ll be stored here.
      </p>
    );
  }

  return (
    <ul className={`space-y-2 ${className}`}>
      <AnimatePresence initial={false}>
        {saves.map((save) => (
          <motion.li
            key={save.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 rounded-md border border-black-wool bg-black-wool/40 p-3"
          >
            <button
              type="button"
              onClick={() => onLoad(save.id)}
              className="flex min-w-0 flex-1 items-baseline gap-x-3 gap-y-1 text-left"
            >
              <span className="truncate font-semibold text-pale-mocha">{save.characterName}</span>
              <span className="shrink-0 text-sm text-au-chico">Level {save.characterLevel}</span>
              <span className="shrink-0 text-sm text-au-chico">{formatPlaytime(save.playtimeMs)}</span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(save.id)}
              aria-label={`Delete ${save.characterName}'s save`}
              title="Delete save"
              className="shrink-0 cursor-pointer text-xl leading-none text-au-chico transition-colors hover:text-red-400"
            >
              ×
            </button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
