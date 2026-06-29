import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { GemShape } from 'bb-calc-js';

import { CustomGemForm } from '#/components/CustomGemForm';
import { useAuth } from '#/lib/auth';
import type { CustomGemInput, CustomGemRow } from '#/lib/customGems';
import { GEM_SHAPES, gemShapeIcon, isCursed, isDrawbackEffect } from '#/lib/gems';
import {
  useCreateCustomGemMutation,
  useDeleteCustomGemMutation,
  useListCustomGemsQuery,
  useUpdateCustomGemMutation,
} from '#/store/api';

const DEFAULT_SHAPE: GemShape = GEM_SHAPES[0];

/** `null` = create; a row = edit that gem. */
type EditorState = { open: false } | { open: true; row: CustomGemRow | null };

/**
 * A logged-in user's saved custom-gem library, shown above the inventory on the
 * Gems tab. Gems can be created, edited, and deleted; the data lives in the
 * `gem` table and is loaded/mutated via RTK Query. Renders nothing when the user
 * is signed out — custom gems are then only ephemeral session state.
 */
export function CustomGemLibrary({ className = '' }: { className?: string }) {
  const { user } = useAuth();
  const { data: rows = [] } = useListCustomGemsQuery(undefined, { skip: !user });
  const [createCustomGem] = useCreateCustomGemMutation();
  const [updateCustomGem] = useUpdateCustomGemMutation();
  const [deleteCustomGem] = useDeleteCustomGemMutation();
  const [editor, setEditor] = useState<EditorState>({ open: false });

  if (!user) return null;

  function handleSubmit(input: CustomGemInput) {
    if (editor.open && editor.row) {
      void updateCustomGem({ id: editor.row.id, input });
    } else {
      void createCustomGem(input);
    }
    setEditor({ open: false });
  }

  return (
    <section className={className}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-au-chico">Your custom gems</h2>
        <button
          type="button"
          onClick={() => setEditor({ open: true, row: null })}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-black-wool px-3 py-1.5 text-sm font-semibold text-pale-mocha transition-colors hover:bg-old-red"
        >
          <Plus className="h-4 w-4" />
          New custom gem
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-au-chico">
          No custom gems yet. Create one here, or from a weapon&rsquo;s gem slot.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {rows.map((row) => (
              <motion.li
                key={row.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="flex gap-3 rounded-md border border-black-wool bg-black-wool/40 p-3"
              >
                <img src={gemShapeIcon(row.shape)} alt={row.shape} className="h-10 w-10 shrink-0 object-contain" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-semibold text-pale-mocha">{row.name}</span>
                      {isCursed(row) && (
                        <span
                          title="Cursed gem — carries a negative effect"
                          className="shrink-0 rounded-sm bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400"
                        >
                          Cursed
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => setEditor({ open: true, row })}
                        aria-label={`Edit ${row.name}`}
                        className="cursor-pointer text-au-chico transition-colors hover:text-pale-mocha"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteCustomGem(row.id)}
                        aria-label={`Delete ${row.name}`}
                        className="cursor-pointer text-au-chico transition-colors hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </span>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {row.effects.map((effect, i) => (
                      <li
                        key={`${effect}-${i}`}
                        className={`text-xs ${isDrawbackEffect(effect) ? 'text-red-400' : 'text-pale-mocha/80'}`}
                      >
                        {effect}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <AnimatePresence>
        {editor.open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <button
              type="button"
              aria-label="Close custom gem editor"
              onClick={() => setEditor({ open: false })}
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
                <h2 className="text-lg font-semibold text-pale-mocha">
                  {editor.row ? 'Edit custom gem' : 'New custom gem'}
                </h2>
                <button
                  type="button"
                  onClick={() => setEditor({ open: false })}
                  aria-label="Close"
                  className="cursor-pointer text-2xl leading-none text-au-chico hover:text-pale-mocha"
                >
                  ×
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <CustomGemForm
                  initialName={editor.row?.name}
                  initialShape={editor.row?.shape ?? DEFAULT_SHAPE}
                  initialEffects={editor.row?.effects}
                  submitLabel={editor.row ? 'Save changes' : 'Create gem'}
                  onSubmit={handleSubmit}
                />
              </div>
            </motion.dialog>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
