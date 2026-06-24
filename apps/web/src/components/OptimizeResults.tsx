import type { OptimizeResult } from '#/lib/bb-calc';
import { DamageTarget } from '#/lib/bb-calc';
import { gemShapeIcon } from '#/lib/gems';
import { PLACEHOLDER_WEAPON_ICON, weaponName, weaponThumbnail } from '#/lib/weapons';

/** Damage lines to show in a result's breakdown, in display order. */
const ELEMENTS = [
  ['Physical', 'physical'],
  ['Blunt', 'blunt'],
  ['Thrust', 'thrust'],
  ['Arcane', 'arcane'],
  ['Fire', 'fire'],
  ['Bolt', 'bolt'],
  ['Blood', 'blood'],
] as const;

/** The headline label for each target — what the prominent score represents. */
const TARGET_LABEL: Record<DamageTarget, string> = {
  [DamageTarget.Total]: 'Attack Rating',
  [DamageTarget.Phys]: 'Physical',
  [DamageTarget.Blunt]: 'Blunt',
  [DamageTarget.Thrust]: 'Thrust',
  [DamageTarget.Arcane]: 'Arcane',
  [DamageTarget.Fire]: 'Fire',
  [DamageTarget.Bolt]: 'Bolt',
  [DamageTarget.Blood]: 'Blood',
};

type OptimizeResultsProps = {
  results: Array<OptimizeResult>;
  /** The target these results were optimized (and ranked) for. */
  target: DamageTarget;
  className?: string;
};

/** Ranks the optimizer's per-weapon results, best score (for `target`) first. */
export function OptimizeResults({ results, target, className = '' }: OptimizeResultsProps) {
  if (results.length === 0) return null;

  const ranked = [...results].sort((a, b) => b.score - a.score);

  return (
    <section className={className}>
      <h2 className="text-2xl font-semibold text-pale-mocha">Results</h2>
      <ul className="mt-4 space-y-4">
        {ranked.map((result) => (
          <li key={result.weaponId} className="rounded-md border border-black-wool bg-black-wool/40 p-4">
            <div className="flex items-center gap-3">
              <img
                src={weaponThumbnail(result.weaponId)}
                alt=""
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = PLACEHOLDER_WEAPON_ICON;
                }}
                className="h-12 w-12 shrink-0 object-contain"
              />
              <h3 className="min-w-0 flex-1 truncate text-lg font-semibold text-pale-mocha">
                {weaponName(result.weaponId)}
              </h3>
              <div className="shrink-0 text-right">
                <div className="text-2xl font-bold text-tamarillo">{Math.round(result.score)}</div>
                <div className="text-xs uppercase tracking-wide text-au-chico">{TARGET_LABEL[target]}</div>
                {target !== DamageTarget.Total && (
                  <div className="text-xs text-pale-mocha/70">AR {Math.round(result.total)}</div>
                )}
              </div>
            </div>

            <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {ELEMENTS.filter(([, key]) => result.breakdown[key] > 0).map(([label, key]) => (
                <div key={key} className="flex gap-1">
                  <dt className="text-au-chico">{label}</dt>
                  <dd className="text-pale-mocha">{Math.round(result.breakdown[key])}</dd>
                </div>
              ))}
            </dl>

            <ul className="mt-3 space-y-2">
              {result.slots.map((slot) => (
                <li
                  key={slot.slot}
                  className="flex items-start gap-2 rounded border border-black-wool px-2 py-1.5 text-xs"
                >
                  <img
                    src={gemShapeIcon(slot.slotShape)}
                    alt={slot.slotShape}
                    className="mt-0.5 h-5 w-5 shrink-0 object-contain"
                  />
                  {slot.gem ? (
                    <div className="min-w-0">
                      <span className="text-pale-mocha">{slot.gem.name}</span>
                      <ul className="mt-0.5 space-y-0.5">
                        {slot.gem.effects.map((effect, i) => (
                          <li key={`${effect}-${i}`} className="text-pale-mocha/70">
                            {effect}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <span className="italic text-au-chico">Empty</span>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
