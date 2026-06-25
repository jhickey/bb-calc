import { useId, useMemo, useState } from 'react';
import type { GemShape, InventoryGem } from 'bb-calc-js';
import { gemFromInventory, parseGemEffects } from 'bb-calc-js';

import type { Socket } from '#/lib/gems';
import { GEM_SHAPES, gemShapeIcon } from '#/lib/gems';

/** A gem fits a slot when shapes match or the gem is the universal Droplet. */
function shapeFits(gemShape: GemShape, slotShape: GemShape): boolean {
  return gemShape === slotShape || gemShape === 'Droplet';
}

type GemPickerModalProps = {
  /** The slot's imprint shape; only gems that fit it are offered. */
  slotShape: GemShape;
  inventoryGems: Array<InventoryGem>;
  /** Ephemeral custom gems created this session, reusable across slots. */
  customGems: Array<Socket>;
  /** Socket the chosen gem. */
  onPick: (socket: Socket) => void;
  /** Register a newly created custom gem so it's reusable elsewhere. */
  onCreateCustom: (socket: Socket) => void;
  /** Empty the slot. */
  onClear: () => void;
  onClose: () => void;
};

const TAB_INVENTORY = 'inventory';
const TAB_CUSTOM = 'custom';

/**
 * Modal for socketing a weapon's gem slot: pick an owned (or previously created
 * custom) gem that fits the slot, or define a new custom gem from effect specs.
 */
export function GemPickerModal({
  slotShape,
  inventoryGems,
  customGems,
  onPick,
  onCreateCustom,
  onClear,
  onClose,
}: GemPickerModalProps) {
  const [tab, setTab] = useState(TAB_INVENTORY);
  const [search, setSearch] = useState('');

  const fittingCustom = useMemo(
    () => customGems.filter((socket) => shapeFits(socket.gem.shape, slotShape)),
    [customGems, slotShape],
  );

  const visibleInventory = useMemo(() => {
    const query = search.trim().toLowerCase();
    return inventoryGems
      .filter((gem) => shapeFits(gem.shape, slotShape))
      .filter((gem) => {
        if (!query) return true;
        return (
          gem.name.toLowerCase().includes(query) || gem.effects.some((effect) => effect.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => b.rating - a.rating);
  }, [inventoryGems, slotShape, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Full-screen backdrop; a real button so closing is keyboard-accessible. */}
      <button
        type="button"
        aria-label="Close gem picker"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-black-wool bg-superhard shadow-xl"
      >
        <header className="flex items-center justify-between gap-2 border-b border-black-wool px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={gemShapeIcon(slotShape)} alt={slotShape} className="h-6 w-6 object-contain" />
            <h2 className="text-lg font-semibold text-pale-mocha">{slotShape} socket</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer text-2xl leading-none text-au-chico hover:text-pale-mocha"
          >
            ×
          </button>
        </header>

        <div className="flex gap-1 border-b border-black-wool px-4" role="tablist">
          {[
            { id: TAB_INVENTORY, label: 'Inventory' },
            { id: TAB_CUSTOM, label: 'Custom gem' },
          ].map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => setTab(entry.id)}
              className={`-mb-px cursor-pointer border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                tab === entry.id
                  ? 'border-tamarillo text-pale-mocha'
                  : 'border-transparent text-au-chico hover:text-pale-mocha'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === TAB_INVENTORY ? (
            <InventoryTab
              search={search}
              onSearch={setSearch}
              gems={visibleInventory}
              customGems={fittingCustom}
              onPickInventory={(gem) => {
                onPick({ gem: gemFromInventory(gem), effects: gem.effects });
                onClose();
              }}
              onPickCustom={(socket) => {
                onPick(socket);
                onClose();
              }}
            />
          ) : (
            <CustomGemTab
              slotShape={slotShape}
              onCreate={(socket) => {
                onCreateCustom(socket);
                onPick(socket);
                onClose();
              }}
            />
          )}
        </div>

        <footer className="border-t border-black-wool px-4 py-3">
          <button
            type="button"
            onClick={() => {
              onClear();
              onClose();
            }}
            className="cursor-pointer text-sm text-au-chico underline transition-colors hover:text-pale-mocha"
          >
            Empty this slot
          </button>
        </footer>
      </div>
    </div>
  );
}

type InventoryTabProps = {
  search: string;
  onSearch: (value: string) => void;
  gems: Array<InventoryGem>;
  customGems: Array<Socket>;
  onPickInventory: (gem: InventoryGem) => void;
  onPickCustom: (socket: Socket) => void;
};

function InventoryTab({ search, onSearch, gems, customGems, onPickInventory, onPickCustom }: InventoryTabProps) {
  return (
    <div>
      <input
        type="search"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder="Search by name or effect…"
        className="w-full rounded-md border border-black-wool bg-black-wool px-3 py-2 text-sm text-pale-mocha placeholder:text-au-chico"
      />

      {customGems.length > 0 && (
        <>
          <p className="mt-4 text-xs uppercase tracking-wide text-au-chico">Custom gems</p>
          <ul className="mt-2 space-y-2">
            {customGems.map((socket, i) => (
              <li key={`custom-${i}`}>
                <GemButton name={socket.gem.name} effects={socket.effects} onClick={() => onPickCustom(socket)} />
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-4 text-xs uppercase tracking-wide text-au-chico">
        {gems.length} fitting gem{gems.length === 1 ? '' : 's'}
      </p>
      {gems.length === 0 ? (
        <p className="mt-2 text-sm text-au-chico">No owned gems fit this slot.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {gems.map((gem) => (
            <li key={gem.id}>
              <GemButton
                name={gem.name}
                rating={gem.rating}
                effects={gem.effects}
                onClick={() => onPickInventory(gem)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type GemButtonProps = {
  name: string;
  rating?: number;
  effects: Array<string>;
  onClick: () => void;
};

function GemButton({ name, rating, effects, onClick }: GemButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full cursor-pointer rounded-md border border-black-wool bg-black-wool/40 px-3 py-2 text-left transition-colors hover:border-tamarillo"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-semibold text-pale-mocha">{name}</span>
        {rating != null && <span className="shrink-0 text-xs text-au-chico">Rating {rating}</span>}
      </div>
      <ul className="mt-0.5 space-y-0.5">
        {effects.map((effect, i) => (
          <li key={`${effect}-${i}`} className="text-xs text-pale-mocha/80">
            {effect}
          </li>
        ))}
      </ul>
    </button>
  );
}

type CustomGemTabProps = {
  slotShape: GemShape;
  onCreate: (socket: Socket) => void;
};

function CustomGemTab({ slotShape, onCreate }: CustomGemTabProps) {
  const nameId = useId();
  const shapeId = useId();
  const effectId = useId();
  const [name, setName] = useState('Custom gem');
  const [shape, setShape] = useState<GemShape>(slotShape);
  const [effects, setEffects] = useState<Array<string>>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  function addEffect() {
    const clause = draft.trim();
    if (!clause) return;
    try {
      // Validate this single clause; throws with a readable message if invalid.
      parseGemEffects(clause, name, shape);
      setEffects((prev) => [...prev, clause]);
      setDraft('');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function create() {
    try {
      const gem = parseGemEffects(effects.join('; '), name || 'Custom gem', shape);
      onCreate({ gem, effects });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={nameId} className="text-xs uppercase tracking-wide text-au-chico">
            Name
          </label>
          <input
            id={nameId}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-md border border-black-wool bg-black-wool px-3 py-2 text-sm text-pale-mocha"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={shapeId} className="text-xs uppercase tracking-wide text-au-chico">
            Imprint
          </label>
          <select
            id={shapeId}
            value={shape}
            onChange={(event) => setShape(event.target.value as GemShape)}
            className="rounded-md border border-black-wool bg-black-wool px-3 py-2 pr-10 text-sm text-pale-mocha"
          >
            {GEM_SHAPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor={effectId} className="text-xs uppercase tracking-wide text-au-chico">
          Add effect
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id={effectId}
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addEffect();
              }
            }}
            placeholder="e.g. phys 27.2%  ·  +15 phys  ·  str-scale 9.9"
            className="min-w-0 flex-1 rounded-md border border-black-wool bg-black-wool px-3 py-2 text-sm text-pale-mocha placeholder:text-au-chico"
          />
          <button
            type="button"
            onClick={addEffect}
            className="shrink-0 cursor-pointer rounded-md bg-black-wool px-3 py-2 text-sm font-semibold text-pale-mocha transition-colors hover:bg-old-red"
          >
            Add
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>

      {effects.length > 0 && (
        <ul className="space-y-1">
          {effects.map((effect, i) => (
            <li
              key={`${effect}-${i}`}
              className="flex items-center justify-between gap-2 rounded border border-black-wool px-3 py-1.5 text-sm text-pale-mocha"
            >
              <span>{effect}</span>
              <button
                type="button"
                onClick={() => setEffects((prev) => prev.filter((_, index) => index !== i))}
                aria-label={`Remove effect ${effect}`}
                className="cursor-pointer text-au-chico hover:text-pale-mocha"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={create}
        disabled={effects.length === 0}
        className="cursor-pointer rounded-md bg-tamarillo px-4 py-2 text-sm font-semibold text-pale-mocha transition-colors hover:bg-old-red disabled:cursor-not-allowed disabled:opacity-50"
      >
        Create &amp; socket
      </button>
    </div>
  );
}
