import type { Character } from 'bb-calc-js';

/** The six leveling stats, in in-game order, with their icon + label. */
const STATS = [
  { key: 'vitality', label: 'Vitality', icon: '/stats/vitality.jpg' },
  { key: 'endurance', label: 'Endurance', icon: '/stats/endurance.jpg' },
  { key: 'strength', label: 'Strength', icon: '/stats/strength.jpg' },
  { key: 'skill', label: 'Skill', icon: '/stats/skill.jpg' },
  { key: 'bloodtinge', label: 'Bloodtinge', icon: '/stats/bloodtinge.jpg' },
  { key: 'arcane', label: 'Arcane', icon: '/stats/arcane.jpg' },
] as const;

type StatsDisplayProps = {
  character: Character;
  className?: string;
};

/** Shows a hunter's six leveling stats with their in-game icons. */
export function StatsDisplay({ character, className = '' }: StatsDisplayProps) {
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
            <span className="text-lg font-semibold text-pale-mocha">{character[key]}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
