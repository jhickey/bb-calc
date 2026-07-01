import { motion } from 'motion/react';

import { GemForm } from '#/components/GemForm';
import type { CustomGemInput, CustomGemRow } from '#/lib/customGems';
import { GEM_SHAPES } from '#/lib/gems';

type GemFormModalProps = {
  /** The gem being edited, or `null` to create a new one. */
  gem: CustomGemRow | null;
  onSubmit: (input: CustomGemInput) => void;
  onClose: () => void;
};

/** Modal wrapper around {@link GemForm} for creating or editing a library gem. */
export function GemFormModal({ gem, onSubmit, onClose }: GemFormModalProps) {
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
        aria-label="Close gem editor"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/60"
      />
      <motion.dialog
        open
        aria-modal="true"
        className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-black-wool bg-superhard shadow-xl"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <header className="flex items-center justify-between gap-2 border-b border-black-wool px-4 py-3">
          <h2 className="text-lg font-semibold text-pale-mocha">{gem ? 'Edit gem' : 'New gem'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer text-2xl leading-none text-au-chico hover:text-pale-mocha"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <GemForm
            initialName={gem?.name}
            initialShape={gem?.shape ?? GEM_SHAPES[0]}
            initialTier={gem?.tier}
            initialEffects={gem?.effects}
            submitLabel={gem ? 'Save changes' : 'Create gem'}
            onSubmit={onSubmit}
          />
        </div>
      </motion.dialog>
    </motion.div>
  );
}
