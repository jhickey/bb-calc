import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { Inventory } from 'bb-calc-js';

import { OptimizerApp } from '#/components/OptimizerApp';
import { useAuth } from '#/lib/auth';
import { loadSaveInventory } from '#/lib/saves';

export const Route = createFileRoute('/s/$saveId')({ component: SaveRoute });

type State =
  | { status: 'loading' }
  | { status: 'ready'; inventory: Inventory }
  | { status: 'unauth' }
  | { status: 'notfound' };

/** A save's editor: loads the owner's inventory by id (refresh re-fetches it). */
function SaveRoute() {
  const { saveId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ status: 'unauth' });
      return;
    }
    let active = true;
    setState({ status: 'loading' });
    loadSaveInventory(saveId)
      .then((inventory) => active && setState({ status: 'ready', inventory }))
      .catch(() => active && setState({ status: 'notfound' }));
    return () => {
      active = false;
    };
  }, [saveId, user, authLoading]);

  if (state.status === 'ready') {
    return <OptimizerApp key={saveId} inventory={state.inventory} initialBuild={null} activeSaveId={saveId} />;
  }

  return (
    <div className="p-8">
      <Link to="/" className="text-sm text-au-chico underline transition-colors hover:text-pale-mocha">
        ← Bloodborne Optimizer
      </Link>
      <p className="mt-6 text-au-chico">
        {state.status === 'loading' && 'Loading save…'}
        {state.status === 'unauth' && 'Log in to view this save.'}
        {state.status === 'notfound' && 'Save not found.'}
      </p>
    </div>
  );
}
