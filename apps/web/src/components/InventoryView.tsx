import type { Inventory } from '#/lib/bb-calc';

import { GemList } from '#/components/GemList';
import { StatsDisplay } from '#/components/StatsDisplay';

type InventoryViewProps = {
  inventory: Inventory;
  className?: string;
};

/** A parsed save's character: name, scaling stats, and owned gems. */
export function InventoryView({ inventory, className = '' }: InventoryViewProps) {
  return (
    <section className={className}>
      <h2 className="text-2xl font-semibold text-pale-mocha">{inventory.character}</h2>
      <StatsDisplay className="mt-4" stats={inventory.stats} />
      <h3 className="mt-6 text-lg font-semibold text-pale-mocha">Gems ({inventory.gems.length})</h3>
      <GemList className="mt-3" gems={inventory.gems} />
    </section>
  );
}
