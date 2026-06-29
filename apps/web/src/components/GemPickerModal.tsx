import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { GemShape, InventoryGem } from 'bb-calc-js';
import { gemFromInventory, parseGemEffects } from 'bb-calc-js';

import { CustomGemForm } from '#/components/CustomGemForm';
import { StorageIcon } from '#/components/StorageIcon';
import type { Socket } from '#/lib/gems';
import { gemShapeIcon, isCursed, isDrawbackEffect } from '#/lib/gems';

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
  /** Gem instance ids already used by other weapons (hidden in Loadout mode). */
  unavailableGemIds?: ReadonlySet<string>;
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
  unavailableGemIds,
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
      .filter((gem) => !unavailableGemIds?.has(gem.id))
      .filter((gem) => {
        if (!query) return true;
        return (
          gem.name.toLowerCase().includes(query) || gem.effects.some((effect) => effect.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => b.rating - a.rating);
  }, [inventoryGems, slotShape, search, unavailableGemIds]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Full-screen backdrop; a real button so closing is keyboard-accessible. */}
      <button
        type="button"
        aria-label="Close gem picker"
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
                onPick({ gem: gemFromInventory(gem), effects: gem.effects, gemId: gem.id });
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
      </motion.dialog>
    </motion.div>
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
                inStorage={gem.inStorage}
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
  inStorage?: boolean;
  onClick: () => void;
};

function GemButton({ name, rating, effects, inStorage = false, onClick }: GemButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full cursor-pointer rounded-md border border-black-wool bg-black-wool/40 px-3 py-2 text-left transition-colors hover:border-tamarillo"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold text-pale-mocha">{name}</span>
          {inStorage && <StorageIcon />}
          {isCursed({ effects }) && (
            <span
              title="Cursed gem — carries a negative effect"
              className="shrink-0 rounded-sm bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400"
            >
              Cursed
            </span>
          )}
        </span>
        {rating != null && <span className="shrink-0 text-xs text-au-chico">Rating {rating}</span>}
      </div>
      <ul className="mt-0.5 space-y-0.5">
        {effects.map((effect, i) => (
          <li
            key={`${effect}-${i}`}
            className={`text-xs ${isDrawbackEffect(effect) ? 'text-red-400' : 'text-pale-mocha/80'}`}
          >
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
  return (
    <CustomGemForm
      initialShape={slotShape}
      submitLabel="Create & socket"
      onSubmit={({ name, shape, effects }) => {
        const gem = parseGemEffects(effects.join('; '), name, shape);
        onCreate({ gem, effects });
      }}
    />
  );
}
