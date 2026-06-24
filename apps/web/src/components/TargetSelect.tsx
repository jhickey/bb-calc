import { DamageTarget } from 'bb-calc-js';

/** Optimization targets, in display order. `Total` is the full Attack Rating. */
const TARGETS: ReadonlyArray<{ value: DamageTarget; label: string }> = [
  { value: DamageTarget.Total, label: 'Total' },
  { value: DamageTarget.Phys, label: 'Physical' },
  { value: DamageTarget.Blunt, label: 'Blunt' },
  { value: DamageTarget.Thrust, label: 'Thrust' },
  { value: DamageTarget.Arcane, label: 'Arcane' },
  { value: DamageTarget.Fire, label: 'Fire' },
  { value: DamageTarget.Bolt, label: 'Bolt' },
  { value: DamageTarget.Blood, label: 'Blood' },
];

type TargetSelectProps = {
  value: DamageTarget;
  onChange: (value: DamageTarget) => void;
  className?: string;
};

/** Picks which damage figure the optimizer maximizes. */
export function TargetSelect({ value, onChange, className = '' }: TargetSelectProps) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs uppercase tracking-wide text-au-chico">Optimize for</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as DamageTarget)}
        className="rounded-md border border-black-wool bg-black-wool py-2 pl-3 pr-10 text-sm text-pale-mocha"
      >
        {TARGETS.map((target) => (
          <option key={target.value} value={target.value}>
            {target.label}
          </option>
        ))}
      </select>
    </label>
  );
}
