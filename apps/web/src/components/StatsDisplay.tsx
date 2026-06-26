import type { Character, Stats } from 'bb-calc-js';

/**
 * The six leveling stats, in in-game order. The four scaling stats
 * (str/skl/blt/arc) are editable and feed the optimizer; vitality and endurance
 * are read-only since they don't affect a weapon's Attack Rating.
 */
const STATS: ReadonlyArray<{
  charKey: keyof Character;
  statKey: keyof Stats | null;
  label: string;
  icon: string;
}> = [
  { charKey: 'vitality', statKey: null, label: 'Vitality', icon: '/stats/vitality.jpg' },
  { charKey: 'endurance', statKey: null, label: 'Endurance', icon: '/stats/endurance.jpg' },
  { charKey: 'strength', statKey: 'str', label: 'Strength', icon: '/stats/strength.jpg' },
  { charKey: 'skill', statKey: 'skl', label: 'Skill', icon: '/stats/skill.jpg' },
  { charKey: 'bloodtinge', statKey: 'blt', label: 'Bloodtinge', icon: '/stats/bloodtinge.jpg' },
  { charKey: 'arcane', statKey: 'arc', label: 'Arcane', icon: '/stats/arcane.jpg' },
];

const MIN_STAT = 0;
const MAX_STAT = 99;

function clampStat(raw: string): number {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return MIN_STAT;
  return Math.min(MAX_STAT, Math.max(MIN_STAT, n));
}

type StatsDisplayProps = {
  /**
   * The save's character — the read-only baseline for each stat. `null` when no
   * save is loaded (logged-out building): only the four editable scaling stats
   * show, with no baseline/revert.
   */
  character: Character | null;
  /** The current (possibly edited) scaling stats fed to the optimizer. */
  stats: Stats;
  onEditStat: (key: keyof Stats, value: number) => void;
  onRevertStat: (key: keyof Stats) => void;
  className?: string;
};

/**
 * A hunter's leveling stats with their in-game icons. Scaling stats are editable
 * number inputs; with a save loaded each shows a revert control when changed,
 * plus the read-only Vitality/Endurance. Without a save, only the four scaling
 * stats render.
 */
export function StatsDisplay({ character, stats, onEditStat, onRevertStat, className = '' }: StatsDisplayProps) {
  // Vitality/Endurance are read-only save values; drop them when there's no save.
  const rows = character ? STATS : STATS.filter((s) => s.statKey != null);
  return (
    <ul className={`flex flex-wrap gap-4 ${className}`}>
      {rows.map(({ charKey, statKey, label, icon }) => {
        const baseline = character ? (character[charKey] as number) : null;
        const value = statKey ? stats[statKey] : (baseline ?? 0);
        const changed = statKey != null && baseline != null && value !== baseline;
        return (
          <li
            key={charKey}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
              changed ? 'border-tamarillo bg-tamarillo/10' : 'border-black-wool bg-black-wool/40'
            }`}
          >
            <img src={icon} alt={label} className="h-8 w-8 rounded-sm object-cover" />
            <div className="flex flex-col leading-tight">
              <span className="text-xs uppercase tracking-wide text-au-chico">{label}</span>
              {statKey ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={MIN_STAT}
                    max={MAX_STAT}
                    value={value}
                    aria-label={label}
                    onChange={(event) => onEditStat(statKey, clampStat(event.target.value))}
                    className="w-12 rounded-sm border border-black-wool bg-black-wool px-1 py-0.5 text-lg font-semibold text-pale-mocha"
                  />
                  {changed && (
                    <button
                      type="button"
                      onClick={() => onRevertStat(statKey)}
                      title={`Revert to ${baseline} (from save)`}
                      aria-label={`Revert ${label} to its save value`}
                      className="cursor-pointer text-base leading-none text-au-chico transition-colors hover:text-pale-mocha"
                    >
                      ↺
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-lg font-semibold text-pale-mocha">{baseline}</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
