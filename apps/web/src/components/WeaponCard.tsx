import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import type { GemShape, InventoryGem, Stats } from 'bb-calc-js';
import { computeAr } from 'bb-calc-js';

import { GemPickerModal } from '#/components/GemPickerModal';
import { ArValue } from '#/components/ArValue';
import type { Socket } from '#/lib/gems';
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
  slots: Array<Socket | null>;
  stats: Stats;
  inventoryGems: Array<InventoryGem>;
  customGems: Array<Socket>;
  /** Gem instance ids used by other weapons (hidden in the picker in Loadout). */
  unavailableGemIds?: ReadonlySet<string>;
  /** This card's position in the list, and the list length, for the reorder controls. */
  index: number;
  total: number;
  /** Upgrade level (+0..=10); folded into the AR calc. */
  level: number;
  onLevelChange: (level: number) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSlotChange: (slotIndex: number, socket: Socket | null) => void;
  onCreateCustom: (socket: Socket) => void;
  onOptimize: () => void;
  onRemove: () => void;
  className?: string;
};

/**
 * A weapon as an interactive build component: three gem slots you socket by
 * hand (or auto-fill via Optimize), with its Attack Rating recomputed live.
 *
 * The list is sortable (the order is Loadout priority): drag the grip handle or
 * use the up/down buttons. dnd-kit owns the drag transform on the outer `<li>`,
 * while the inner `motion.div` only fades/slides on enter/exit so the two never
 * fight over the element's transform.
 */
export function WeaponCard({
  weaponId,
  slots,
  stats,
  inventoryGems,
  customGems,
  unavailableGemIds,
  index,
  total,
  level,
  onLevelChange,
  onMoveUp,
  onMoveDown,
  onSlotChange,
  onCreateCustom,
  onOptimize,
  onRemove,
  className = '',
}: WeaponCardProps) {
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const weapon = weaponById(weaponId);
  const slotShapes: Array<GemShape> = weapon ? [weapon.gemSlot1, weapon.gemSlot2, weapon.gemSlot3] : [];

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: weaponId });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const breakdown = useMemo(
    () =>
      computeAr(
        weaponId,
        slots.filter((socket): socket is Socket => socket != null).map((socket) => socket.gem),
        stats,
        level,
      ),
    [weaponId, slots, stats, level],
  );

  const name = weaponName(weaponId);

  return (
    <li ref={setNodeRef} style={style} className={`relative ${isDragging ? 'z-10' : ''} ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={`rounded-md border bg-black-wool/40 p-4 ${
          isDragging ? 'border-tamarillo/60 shadow-xl shadow-black/40' : 'border-black-wool'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex shrink-0 flex-col items-center gap-0.5">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={index === 0}
              aria-label={`Move ${name} up`}
              className="cursor-pointer rounded text-au-chico transition-colors hover:text-pale-mocha disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:text-au-chico"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              {...attributes}
              {...listeners}
              aria-label={`Drag ${name} to reorder`}
              className="cursor-grab touch-none text-au-chico transition-colors hover:text-pale-mocha active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={index === total - 1}
              aria-label={`Move ${name} down`}
              className="cursor-pointer rounded text-au-chico transition-colors hover:text-pale-mocha disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:text-au-chico"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <img
            src={weaponThumbnail(weaponId)}
            alt=""
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = PLACEHOLDER_WEAPON_ICON;
            }}
            className="h-12 w-12 shrink-0 object-contain"
          />
          <h3 className="min-w-0 flex-1 truncate text-lg font-semibold text-pale-mocha">{name}</h3>
          <div className="shrink-0 text-center">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onLevelChange(level - 1)}
                disabled={level <= 0}
                aria-label={`Lower ${name} upgrade level`}
                className="cursor-pointer rounded border border-black-wool px-1.5 text-base leading-none text-au-chico transition-colors hover:border-tamarillo hover:text-pale-mocha disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:border-black-wool disabled:hover:text-au-chico"
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-bold tabular-nums text-pale-mocha">+{level}</span>
              <button
                type="button"
                onClick={() => onLevelChange(level + 1)}
                disabled={level >= 10}
                aria-label={`Raise ${name} upgrade level`}
                className="cursor-pointer rounded border border-black-wool px-1.5 text-base leading-none text-au-chico transition-colors hover:border-tamarillo hover:text-pale-mocha disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:border-black-wool disabled:hover:text-au-chico"
              >
                +
              </button>
            </div>
            <div className="text-xs uppercase tracking-wide text-au-chico">Level</div>
          </div>
          <div className="shrink-0 text-right">
            <ArValue value={breakdown.total} className="text-2xl font-bold text-tamarillo" />
            <div className="text-xs uppercase tracking-wide text-au-chico">Attack Rating</div>
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${name}`}
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
          {slotShapes.map((shape, slotIndex) => {
            const socket = slots[slotIndex] ?? null;
            return (
              <li key={slotIndex}>
                <button
                  type="button"
                  onClick={() => setOpenSlot(slotIndex)}
                  className="flex w-full items-start gap-2 rounded border border-black-wool px-2 py-1.5 text-left text-xs transition-colors hover:border-tamarillo"
                >
                  <img src={gemShapeIcon(shape)} alt={shape} className="mt-0.5 h-5 w-5 shrink-0 object-contain" />
                  {socket ? (
                    <div className="min-w-0 flex-1">
                      <span className="text-pale-mocha">{socket.gem.name}</span>
                      <ul className="mt-0.5 space-y-0.5">
                        {socket.effects.map((effect, i) => (
                          <li key={`${effect}-${i}`} className="text-pale-mocha/70">
                            {effect}
                          </li>
                        ))}
                      </ul>
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
          {slots.some((socket) => socket != null) && (
            <button
              type="button"
              onClick={() => slots.forEach((_, slotIndex) => onSlotChange(slotIndex, null))}
              className="cursor-pointer text-sm text-au-chico underline transition-colors hover:text-pale-mocha"
            >
              Clear gems
            </button>
          )}
        </div>

        <AnimatePresence>
          {openSlot != null && (
            <GemPickerModal
              key="gem-picker"
              slotShape={slotShapes[openSlot]}
              inventoryGems={inventoryGems}
              customGems={customGems}
              unavailableGemIds={unavailableGemIds}
              onPick={(socket) => onSlotChange(openSlot, socket)}
              onCreateCustom={onCreateCustom}
              onClear={() => onSlotChange(openSlot, null)}
              onClose={() => setOpenSlot(null)}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </li>
  );
}
