import type { Inventory } from '#/lib/bb-calc';

import { SaveUpload } from '#/components/SaveUpload';
import { StatsDisplay } from '#/components/StatsDisplay';

type CharacterHeaderProps = {
  inventory: Inventory | null;
  onFile: (file: File) => void;
  className?: string;
};

/**
 * Top-of-page header: the imported character's name and stats on the left, with
 * the Import Save button aligned right. Before a save is imported, the left side
 * shows a prompt instead.
 */
export function CharacterHeader({ inventory, onFile, className = '' }: CharacterHeaderProps) {
  return (
    <header className={`flex flex-wrap items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {inventory ? (
          <>
            <h2 className="text-2xl font-semibold text-pale-mocha">{inventory.character}</h2>
            <StatsDisplay className="mt-3" stats={inventory.stats} />
          </>
        ) : (
          <p className="text-au-chico">Import a save to begin.</p>
        )}
      </div>
      <SaveUpload onFile={onFile} />
    </header>
  );
}
