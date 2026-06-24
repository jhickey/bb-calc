import type { OptimizeResult } from '#/lib/bb-calc';
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

type OptimizeResultsProps = {
  results: Array<OptimizeResult>;
  className?: string;
};

/** Ranks the optimizer's per-weapon results, best Attack Rating first. */
export function OptimizeResults({ results, className = '' }: OptimizeResultsProps) {
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
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="truncate text-lg font-semibold text-pale-mocha">{weaponName(result.weaponId)}</h3>
                  <span className="shrink-0 text-2xl font-bold text-tamarillo">{Math.round(result.total)}</span>
                </div>
                <span className="text-xs uppercase tracking-wide text-au-chico">Attack Rating</span>
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
