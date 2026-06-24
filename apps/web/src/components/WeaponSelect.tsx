import { useMemo, useState } from 'react';

import { getWeapons } from 'bb-calc-js';
import { PLACEHOLDER_WEAPON_ICON, weaponThumbnail } from '#/lib/weapons';

type WeaponSelectProps = {
  selected: ReadonlyArray<string>;
  onChange: (ids: Array<string>) => void;
  className?: string;
};

/**
 * A multi-select checklist of every weapon to compare. Reads the weapon list
 * from the calculator, so it must only render after the WASM module is ready
 * (i.e. once a save has been parsed).
 */
export function WeaponSelect({ selected, onChange, className = '' }: WeaponSelectProps) {
  const weapons = useMemo(() => getWeapons(), []);
  const [search, setSearch] = useState('');
  const selectedSet = new Set(selected);

  const query = search.trim().toLowerCase();
  const visible = query ? weapons.filter((weapon) => weapon.name.toLowerCase().includes(query)) : weapons;

  function toggle(id: string) {
    const next = new Set(selectedSet);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange([...next]);
  }

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-au-chico">Weapons ({selected.length})</span>
        <div className="flex gap-3 text-xs">
          <button
            type="button"
            className="cursor-pointer text-au-chico transition-colors hover:text-pale-mocha"
            onClick={() => onChange([...new Set([...selected, ...visible.map((weapon) => weapon.id)])])}
          >
            Select all
          </button>
          <button
            type="button"
            className="cursor-pointer text-au-chico transition-colors hover:text-pale-mocha"
            onClick={() => onChange([])}
          >
            Clear
          </button>
        </div>
      </div>
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search weapons…"
        className="mt-2 w-full rounded-md border border-black-wool bg-black-wool px-3 py-2 text-sm text-pale-mocha placeholder:text-au-chico"
      />
      <ul className="mt-2 max-h-72 overflow-y-auto rounded-md border border-black-wool bg-black-wool/40 p-2">
        {visible.length === 0 && <li className="px-2 py-1 text-sm text-au-chico">No weapons match.</li>}
        {visible.map((weapon) => (
          <li key={weapon.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-old-red/30">
              <input
                type="checkbox"
                checked={selectedSet.has(weapon.id)}
                onChange={() => toggle(weapon.id)}
                className="accent-tamarillo"
              />
              <img
                src={weaponThumbnail(weapon.id)}
                alt=""
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = PLACEHOLDER_WEAPON_ICON;
                }}
                className="h-6 w-6 shrink-0 object-contain"
              />
              <span className="text-sm text-pale-mocha">{weapon.name}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
