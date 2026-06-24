import { useMemo, useState } from 'react';

import type { GemShape, InventoryGem } from 'bb-calc-js';
import { GemList } from '#/components/GemList';
import { GEM_SHAPES, gemShapeIcon } from '#/lib/gems';

type GemsPanelProps = {
  gems: Array<InventoryGem>;
  className?: string;
};

/**
 * The Gems tab: search (name + effects) and per-shape toggles over the
 * inventory, sorted by rating (tier) descending.
 */
export function GemsPanel({ gems, className = '' }: GemsPanelProps) {
  const [search, setSearch] = useState('');
  // No shapes selected means "no shape filter" — show every shape.
  const [shapes, setShapes] = useState<Set<GemShape>>(() => new Set());

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

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return gems
      .filter((gem) => shapes.size === 0 || shapes.has(gem.shape))
      .filter((gem) => {
        if (!query) return true;
        return (
          gem.name.toLowerCase().includes(query) || gem.effects.some((effect) => effect.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => b.rating - a.rating);
  }, [gems, search, shapes]);

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
      </div>

      <p className="mt-3 text-xs uppercase tracking-wide text-au-chico">
        Showing {visible.length} of {gems.length}
      </p>

      <GemList className="mt-3" gems={visible} emptyMessage="No gems match your filters." />
    </div>
  );
}
