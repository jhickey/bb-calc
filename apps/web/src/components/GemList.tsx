import type { InventoryGem } from 'bb-calc-js';
import { gemShapeIcon } from '#/lib/gems';

type GemListProps = {
  gems: Array<InventoryGem>;
  emptyMessage?: string;
  className?: string;
};

/** Lists the gems in an inventory, each with its imprint-shape icon. */
export function GemList({ gems, emptyMessage = 'No gems in inventory.', className = '' }: GemListProps) {
  if (gems.length === 0) {
    return <p className={`text-sm text-au-chico ${className}`}>{emptyMessage}</p>;
  }

  return (
    <ul className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {gems.map((gem) => (
        <li key={gem.id} className="flex gap-3 rounded-md border border-black-wool bg-black-wool/40 p-3">
          <img src={gemShapeIcon(gem.shape)} alt={gem.shape} className="h-10 w-10 shrink-0 object-contain" />
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-semibold text-pale-mocha">{gem.name}</span>
              <span className="shrink-0 text-xs text-au-chico">Rating {gem.rating}</span>
            </div>
            <ul className="mt-1 space-y-0.5">
              {gem.effects.map((effect, i) => (
                <li key={`${effect}-${i}`} className="text-xs text-pale-mocha/80">
                  {effect}
                </li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ul>
  );
}
