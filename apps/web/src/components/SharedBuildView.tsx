import type { GemShape } from 'bb-calc-js';
import { computeAr } from 'bb-calc-js';

import { ArValue } from '#/components/ArValue';
import type { BuildConfig } from '#/lib/builds';
import type { Socket } from '#/lib/gems';
import { gemShapeIcon, isCursed, isDrawbackEffect } from '#/lib/gems';
import { PLACEHOLDER_WEAPON_ICON, weaponById, weaponName, weaponThumbnail } from '#/lib/weapons';

const ELEMENTS = [
  ['Physical', 'physical'],
  ['Blunt', 'blunt'],
  ['Thrust', 'thrust'],
  ['Arcane', 'arcane'],
  ['Fire', 'fire'],
  ['Bolt', 'bolt'],
  ['Blood', 'blood'],
] as const;

const STAT_LABELS: ReadonlyArray<['str' | 'skl' | 'blt' | 'arc', string]> = [
  ['str', 'Strength'],
  ['skl', 'Skill'],
  ['blt', 'Bloodtinge'],
  ['arc', 'Arcane'],
];

/** A read-only rendering of a build (its weapons, gems, levels, stats, and AR). */
export function SharedBuildView({ name, config }: { name: string; config: BuildConfig }) {
  const { editStats: stats, weaponIds, slotsByWeapon, levelByWeapon } = config;

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-au-chico">Shared build</p>
      <h2 className="mt-1 text-2xl font-semibold text-pale-mocha">{name}</h2>

      <ul className="mt-4 flex flex-wrap gap-4">
        {STAT_LABELS.map(([key, label]) => (
          <li key={key} className="rounded-md border border-black-wool bg-black-wool/40 px-3 py-2">
            <span className="text-xs uppercase tracking-wide text-au-chico">{label}</span>
            <span className="ml-2 text-lg font-semibold text-pale-mocha">{stats[key]}</span>
          </li>
        ))}
      </ul>

      {weaponIds.length === 0 ? (
        <p className="mt-6 text-au-chico">This build has no weapons.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {weaponIds.map((weaponId) => (
            <WeaponView
              key={weaponId}
              weaponId={weaponId}
              slots={slotsByWeapon[weaponId] ?? [null, null, null]}
              level={levelByWeapon[weaponId] ?? 10}
              stats={stats}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function WeaponView({
  weaponId,
  slots,
  level,
  stats,
}: {
  weaponId: string;
  slots: Array<Socket | null>;
  level: number;
  stats: BuildConfig['editStats'];
}) {
  const weapon = weaponById(weaponId);
  const slotShapes: Array<GemShape> = weapon ? [weapon.gemSlot1, weapon.gemSlot2, weapon.gemSlot3] : [];
  const gems = slots.filter((s): s is Socket => s != null).map((s) => s.gem);
  const breakdown = computeAr(weaponId, gems, stats, level);

  return (
    <li className="rounded-md border border-black-wool bg-black-wool/40 p-4">
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
        <div className="shrink-0 text-center">
          <div className="text-lg font-bold tabular-nums text-pale-mocha">+{level}</div>
          <div className="text-xs uppercase tracking-wide text-au-chico">Level</div>
        </div>
        <div className="shrink-0 text-right">
          <ArValue value={breakdown.total} className="text-2xl font-bold text-tamarillo" />
          <div className="text-xs uppercase tracking-wide text-au-chico">Attack Rating</div>
        </div>
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
          const socket = slots[index] ?? null;
          return (
            <li key={index} className="flex items-start gap-2 rounded border border-black-wool px-2 py-1.5 text-xs">
              <img src={gemShapeIcon(shape)} alt={shape} className="mt-0.5 h-5 w-5 shrink-0 object-contain" />
              {socket ? (
                <div className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-pale-mocha">{socket.gem.name}</span>
                    {isCursed(socket) && (
                      <span className="shrink-0 rounded-sm bg-red-500/20 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-400">
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
                <span className="flex-1 italic text-au-chico">Empty {shape} slot</span>
              )}
            </li>
          );
        })}
      </ul>
    </li>
  );
}
