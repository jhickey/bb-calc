import type { Stats } from '#/lib/bb-calc';

/** The four scaling stats, in display order, with their icon + label. */
const STATS = [
  { key: 'str', label: 'Strength', icon: '/stats/strength.jpg' },
  { key: 'skl', label: 'Skill', icon: '/stats/skill.jpg' },
  { key: 'blt', label: 'Bloodtinge', icon: '/stats/bloodtinge.jpg' },
  { key: 'arc', label: 'Arcane', icon: '/stats/arcane.jpg' },
] as const;

type StatsDisplayProps = {
  stats: Stats;
  className?: string;
};

/** Shows a hunter's four scaling stats with their in-game icons. */
export function StatsDisplay({ stats, className = '' }: StatsDisplayProps) {
  return (
    <ul className={`flex flex-wrap gap-4 ${className}`}>
      {STATS.map(({ key, label, icon }) => (
        <li
          key={key}
          className="flex items-center gap-2 rounded-md border border-black-wool bg-black-wool/40 px-3 py-2"
        >
          <img src={icon} alt={label} className="h-8 w-8 rounded-sm object-cover" />
          <div className="flex flex-col leading-tight">
            <span className="text-xs uppercase tracking-wide text-au-chico">{label}</span>
            <span className="text-lg font-semibold text-pale-mocha">{stats[key]}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
