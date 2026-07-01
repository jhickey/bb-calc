import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Ban, ChevronDown, ChevronUp, GripVertical, X } from 'lucide-react';
import type { GemShape, InventoryGem } from 'bb-calc-js';
import { computeAr } from 'bb-calc-js';

import { GemPickerModal } from '#/components/GemPickerModal';
import { ArValue } from '#/components/ArValue';
import { useAuth } from '#/lib/auth';
import { customGemToSocket } from '#/lib/gemEffects';
import type { Socket } from '#/lib/gems';
import { gemShapeIcon, isCursed, isDrawbackEffect } from '#/lib/gems';
import { PLACEHOLDER_WEAPON_ICON, weaponById, weaponName, weaponThumbnail } from '#/lib/weapons';
import { useAppDispatch, useAppSelector } from '#/store';
import { useCreateCustomGemMutation, useListCustomGemsQuery } from '#/store/api';
import { buildActions } from '#/store/buildSlice';

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

const EMPTY_SLOTS: ReadonlyArray<Socket | null> = [null, null, null];
const EMPTY_GEMS: Array<InventoryGem> = [];

type WeaponCardProps = {
  weaponId: string;
  /** This card's position in the list, and the list length, for the reorder controls. */
  index: number;
  total: number;
  /** Drop an owned gem from auto-optimization (re-optimizes the whole set). */
  onExcludeGem: (gemId: string) => void;
  /** Auto-optimize just this weapon. */
  onOptimize: () => void;
};

/**
 * A weapon as an interactive build component: three gem slots you socket by
 * hand (or auto-fill via Optimize), with its Attack Rating recomputed live. All
 * build state is read from / written to the Redux `build` slice.
 *
 * The list is sortable (the order is Loadout priority): drag the grip handle or
 * use the up/down buttons. dnd-kit owns the drag transform on the outer `<li>`,
 * while the inner `motion.div` only fades/slides on enter/exit.
 */
export function WeaponCard({ weaponId, index, total, onExcludeGem, onOptimize }: WeaponCardProps) {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const slots = useAppSelector((s) => s.build.slotsByWeapon[weaponId]) ?? EMPTY_SLOTS;
  const level = useAppSelector((s) => s.build.levelByWeapon[weaponId] ?? 10);
  const stats = useAppSelector((s) => s.build.editStats);
  const inventoryGems = useAppSelector((s) => s.build.inventory?.gems) ?? EMPTY_GEMS;
  const sessionCustomGems = useAppSelector((s) => s.build.customGems);
  const mode = useAppSelector((s) => s.build.mode);
  const slotsByWeapon = useAppSelector((s) => s.build.slotsByWeapon);

  // Logged-in users draw custom gems from their persisted library; logged-out
  // users use the ephemeral session list in the build slice.
  const { data: libraryRows = [] } = useListCustomGemsQuery(undefined, { skip: !user });
  const [createCustomGem] = useCreateCustomGemMutation();
  const libraryGems = useMemo<Array<Socket>>(() => libraryRows.map(customGemToSocket), [libraryRows]);
  const customGems = user ? libraryGems : sessionCustomGems;

  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const weapon = weaponById(weaponId);
  const slotShapes: Array<GemShape> = weapon ? [weapon.gemSlot1, weapon.gemSlot2, weapon.gemSlot3] : [];

  // In Loadout, gems socketed in other weapons are unavailable to this one.
  const unavailableGemIds = useMemo(() => {
    if (mode !== 'loadout') return undefined;
    const ids = new Set<string>();
    for (const [id, otherSlots] of Object.entries(slotsByWeapon)) {
      if (id === weaponId) continue;
      for (const socket of otherSlots) if (socket?.gemId) ids.add(socket.gemId);
    }
    return ids;
  }, [slotsByWeapon, mode, weaponId]);

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
  const setSlot = (slotIndex: number, socket: Socket | null) =>
    dispatch(buildActions.setSlot({ weaponId, slotIndex, socket }));

  return (
    <li ref={setNodeRef} style={style} className={`relative ${isDragging ? 'z-10' : ''}`}>
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
              onClick={() => dispatch(buildActions.moveWeapon({ from: index, to: index - 1 }))}
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
              onClick={() => dispatch(buildActions.moveWeapon({ from: index, to: index + 1 }))}
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
                onClick={() => dispatch(buildActions.setLevel({ weaponId, level: level - 1 }))}
                disabled={level <= 0}
                aria-label={`Lower ${name} upgrade level`}
                className="cursor-pointer rounded border border-black-wool px-1.5 text-base leading-none text-au-chico transition-colors hover:border-tamarillo hover:text-pale-mocha disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:border-black-wool disabled:hover:text-au-chico"
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-bold tabular-nums text-pale-mocha">+{level}</span>
              <button
                type="button"
                onClick={() => dispatch(buildActions.setLevel({ weaponId, level: level + 1 }))}
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
            onClick={() => dispatch(buildActions.removeWeapon(weaponId))}
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
              <li key={slotIndex} className="flex items-stretch gap-1">
                <button
                  type="button"
                  onClick={() => setOpenSlot(slotIndex)}
                  className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded border border-black-wool px-2 py-1.5 text-left text-xs transition-colors hover:border-tamarillo"
                >
                  <img src={gemShapeIcon(shape)} alt={shape} className="mt-0.5 h-5 w-5 shrink-0 object-contain" />
                  {socket ? (
                    <div className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-pale-mocha">{socket.gem.name}</span>
                        {isCursed(socket) && (
                          <span
                            title="Cursed gem — carries a negative effect"
                            className="shrink-0 rounded-sm bg-red-500/20 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-400"
                          >
                            Cursed
                          </span>
                        )}
                      </span>
                      <ul className="mt-0.5 space-y-0.5">
                        {socket.effects.map((effect, i) => (
                          <li
                            key={`${effect}-${i}`}
                            className={isDrawbackEffect(effect) ? 'text-red-400' : 'text-pale-mocha/70'}
                          >
                            {effect}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <span className="flex-1 italic text-au-chico">Empty {shape} slot — click to socket</span>
                  )}
                </button>
                {socket && (
                  <>
                    {socket.gemId && (
                      <button
                        type="button"
                        onClick={() => onExcludeGem(socket.gemId!)}
                        aria-label={`Exclude ${socket.gem.name} from optimization`}
                        title="Leave this gem out of auto-optimization"
                        className="flex shrink-0 items-center gap-1 rounded border border-black-wool px-2 text-xs text-au-chico transition-colors hover:border-old-red hover:text-red-400"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Exclude
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSlot(slotIndex, null)}
                      aria-label={`Empty ${shape} slot`}
                      title="Empty this slot"
                      className="flex shrink-0 items-center rounded border border-black-wool px-2 text-au-chico transition-colors hover:border-old-red hover:text-pale-mocha"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
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
              onClick={() => slots.forEach((_, slotIndex) => setSlot(slotIndex, null))}
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
              onPick={(socket) => setSlot(openSlot, socket)}
              onCreateCustom={(input) => {
                if (user) {
                  void createCustomGem(input);
                } else {
                  dispatch(buildActions.addCustomGem(customGemToSocket(input)));
                }
              }}
              onClear={() => setSlot(openSlot, null)}
              onClose={() => setOpenSlot(null)}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </li>
  );
}
