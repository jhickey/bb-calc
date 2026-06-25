import { useMemo, useState } from 'react';
import type { Gem, GemShape, InventoryGem, Stats } from 'bb-calc-js';
import { computeAr } from 'bb-calc-js';

import { GemPickerModal } from '#/components/GemPickerModal';
import { gemShapeIcon } from '#/lib/gems';
import { PLACEHOLDER_WEAPON_ICON, weaponById, weaponName, weaponThumbnail } from '#/lib/weapons';

/** Damage lines shown in the breakdown, in display order. */
const ELEMENTS = [
  ['Physical', 'physical'],
  ['Blunt', 'blunt'],
  ['Thrust', 'thrust'],
  ['Arcane', 'arcane'],
  ['Fire', 'fire'],
  ['Bolt', 'bolt'],
  ['Blood', 'blood'],
] as const;

type WeaponCardProps = {
  weaponId: string;
  /** Three slots, in imprint order; `null` is empty. */
  slots: Array<Gem | null>;
  stats: Stats;
  inventoryGems: Array<InventoryGem>;
  customGems: Array<Gem>;
  onSlotChange: (slotIndex: number, gem: Gem | null) => void;
  onCreateCustom: (gem: Gem) => void;
  onOptimize: () => void;
  onRemove: () => void;
  className?: string;
};

/**
 * A weapon as an interactive build component: three gem slots you socket by
 * hand (or auto-fill via Optimize), with its Attack Rating recomputed live.
 */
export function WeaponCard({
  weaponId,
  slots,
  stats,
  inventoryGems,
  customGems,
  onSlotChange,
  onCreateCustom,
  onOptimize,
  onRemove,
  className = '',
}: WeaponCardProps) {
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const weapon = weaponById(weaponId);
  const slotShapes: Array<GemShape> = weapon ? [weapon.gemSlot1, weapon.gemSlot2, weapon.gemSlot3] : [];

  const breakdown = useMemo(
    () =>
      computeAr(
        weaponId,
        slots.filter((gem): gem is Gem => gem != null),
        stats,
      ),
    [weaponId, slots, stats],
  );

  return (
    <li className={`rounded-md border border-black-wool bg-black-wool/40 p-4 ${className}`}>
      <div className="flex items-center gap-3">
        <img
          src={weaponThumbnail(weaponId)}
          alt=""
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = PLACEHOLDER_WEAPON_ICON;
          }}
          className="h-12 w-12 shrink-0 object-contain"
        />
        <h3 className="min-w-0 flex-1 truncate text-lg font-semibold text-pale-mocha">{weaponName(weaponId)}</h3>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-bold text-tamarillo">{Math.round(breakdown.total)}</div>
          <div className="text-xs uppercase tracking-wide text-au-chico">Attack Rating</div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${weaponName(weaponId)}`}
          className="shrink-0 cursor-pointer text-xl leading-none text-au-chico hover:text-pale-mocha"
        >
          ×
        </button>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {ELEMENTS.filter(([, key]) => breakdown[key] > 0).map(([label, key]) => (
          <div key={key} className="flex gap-1">
            <dt className="text-au-chico">{label}</dt>
            <dd className="text-pale-mocha">{Math.round(breakdown[key])}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-3 space-y-2">
        {slotShapes.map((shape, index) => {
          const gem = slots[index] ?? null;
          return (
            <li key={index}>
              <button
                type="button"
                onClick={() => setOpenSlot(index)}
                className="flex w-full items-start gap-2 rounded border border-black-wool px-2 py-1.5 text-left text-xs transition-colors hover:border-tamarillo"
              >
                <img src={gemShapeIcon(shape)} alt={shape} className="mt-0.5 h-5 w-5 shrink-0 object-contain" />
                {gem ? (
                  <div className="min-w-0 flex-1">
                    <span className="text-pale-mocha">{gem.name}</span>
                  </div>
                ) : (
                  <span className="flex-1 italic text-au-chico">Empty {shape} slot — click to socket</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={onOptimize}
          className="cursor-pointer rounded-md bg-black-wool px-3 py-1.5 text-sm font-semibold text-pale-mocha transition-colors hover:bg-old-red"
        >
          Auto-optimize
        </button>
        {slots.some((gem) => gem != null) && (
          <button
            type="button"
            onClick={() => slots.forEach((_, index) => onSlotChange(index, null))}
            className="cursor-pointer text-sm text-au-chico underline transition-colors hover:text-pale-mocha"
          >
            Clear gems
          </button>
        )}
      </div>

      {openSlot != null && (
        <GemPickerModal
          slotShape={slotShapes[openSlot]}
          inventoryGems={inventoryGems}
          customGems={customGems}
          onPick={(gem) => onSlotChange(openSlot, gem)}
          onCreateCustom={onCreateCustom}
          onClear={() => onSlotChange(openSlot, null)}
          onClose={() => setOpenSlot(null)}
        />
      )}
    </li>
  );
}
