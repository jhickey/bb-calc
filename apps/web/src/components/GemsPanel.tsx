import { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Plus } from 'lucide-react';

import type { GemShape, InventoryGem } from 'bb-calc-js';
import { GemFormModal } from '#/components/GemFormModal';
import { GemList } from '#/components/GemList';
import { useAuth } from '#/lib/auth';
import type { CustomGemInput, CustomGemRow } from '#/lib/customGems';
import type { DisplayGem } from '#/lib/gems';
import { GEM_SHAPES, effectText, gemShapeIcon } from '#/lib/gems';
import {
  useCreateCustomGemMutation,
  useDeleteCustomGemMutation,
  useListCustomGemsQuery,
  useUpdateCustomGemMutation,
} from '#/store/api';

type GemsPanelProps = {
  gems: Array<InventoryGem>;
  className?: string;
};

/** `null` = create; a row = edit that gem. */
type EditorState = { open: false } | { open: true; gem: CustomGemRow | null };

/**
 * The Gems tab: the player's owned gems and their saved custom gems shown in one
 * list, searchable and filterable by shape, sorted by tier. Custom gems carry
 * edit/delete controls; a "New Gem" button (when signed in) creates more.
 */
export function GemsPanel({ gems, className = '' }: GemsPanelProps) {
  const { user } = useAuth();
  const { data: customRows = [] } = useListCustomGemsQuery(undefined, { skip: !user });
  const [createCustomGem] = useCreateCustomGemMutation();
  const [updateCustomGem] = useUpdateCustomGemMutation();
  const [deleteCustomGem] = useDeleteCustomGemMutation();

  const [search, setSearch] = useState('');
  // No shapes selected means "no shape filter" — show every shape.
  const [shapes, setShapes] = useState<Set<GemShape>>(() => new Set());
  const [editor, setEditor] = useState<EditorState>({ open: false });

  function toggleShape(shape: GemShape) {
    setShapes((prev) => {
      const next = new Set(prev);
      if (next.has(shape)) {
        next.delete(shape);
      } else {
        next.add(shape);
      }
      return next;
    });
  }

  const all = useMemo<Array<DisplayGem>>(() => {
    const inventory: Array<DisplayGem> = gems.map((gem) => ({
      key: gem.id,
      name: gem.name,
      shape: gem.shape,
      tier: gem.rating,
      effects: gem.effects,
      inStorage: gem.inStorage,
      inUse: gem.inUse,
    }));
    const custom: Array<DisplayGem> = customRows.map((row) => ({
      key: row.id,
      name: row.name,
      shape: row.shape,
      tier: row.tier,
      effects: row.effects,
      onEdit: () => setEditor({ open: true, gem: row }),
      onDelete: () => void deleteCustomGem(row.id),
    }));
    return [...custom, ...inventory];
  }, [gems, customRows, deleteCustomGem]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return all
      .filter((gem) => shapes.size === 0 || shapes.has(gem.shape))
      .filter((gem) => {
        if (!query) return true;
        return (
          gem.name.toLowerCase().includes(query) ||
          gem.effects.some((effect) => effectText(effect).toLowerCase().includes(query))
        );
      })
      .sort((a, b) => b.tier - a.tier);
  }, [all, search, shapes]);

  function handleSubmit(input: CustomGemInput) {
    if (editor.open && editor.gem) {
      void updateCustomGem({ id: editor.gem.id, input });
    } else {
      void createCustomGem(input);
    }
    setEditor({ open: false });
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or effect…"
          className="min-w-60 flex-1 rounded-md border border-black-wool bg-black-wool px-3 py-2 text-sm text-pale-mocha placeholder:text-au-chico"
        />
        <div className="flex flex-wrap gap-2">
          {GEM_SHAPES.map((shape) => {
            const on = shapes.has(shape);
            return (
              <button
                key={shape}
                type="button"
                aria-pressed={on}
                onClick={() => toggleShape(shape)}
                title={shape}
                className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                  on
                    ? 'border-tamarillo bg-tamarillo/20 text-pale-mocha'
                    : 'border-black-wool text-au-chico hover:text-pale-mocha'
                }`}
              >
                <img src={gemShapeIcon(shape)} alt="" className={`h-5 w-5 object-contain ${on ? '' : 'opacity-40'}`} />
                {shape}
              </button>
            );
          })}
        </div>
        {user && (
          <button
            type="button"
            onClick={() => setEditor({ open: true, gem: null })}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-black-wool px-3 py-2 text-sm font-semibold text-pale-mocha transition-colors hover:bg-old-red"
          >
            <Plus className="h-4 w-4" />
            New Gem
          </button>
        )}
      </div>

      <p className="mt-3 text-xs uppercase tracking-wide text-au-chico">
        Showing {visible.length} of {all.length}
      </p>

      <GemList className="mt-3" gems={visible} emptyMessage="No gems match your filters." />

      <AnimatePresence>
        {editor.open && (
          <GemFormModal gem={editor.gem} onSubmit={handleSubmit} onClose={() => setEditor({ open: false })} />
        )}
      </AnimatePresence>
    </div>
  );
}
