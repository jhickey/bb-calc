import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { Inventory } from 'bb-calc-js';

import { OptimizerApp } from '#/components/OptimizerApp';
import { useAuth } from '#/lib/auth';
import type { BuildConfig } from '#/lib/builds';
import { getBuildForEdit } from '#/lib/builds';
import { loadSaveInventory } from '#/lib/saves';

export const Route = createFileRoute('/builds/$buildId')({ component: BuildRoute });

type State =
  | { status: 'loading' }
  | { status: 'ready'; config: BuildConfig; inventory: Inventory | null; saveId: string | null }
  | { status: 'unauth' }
  | { status: 'notfound' };

/** Whether a build's sockets reference inventory gems (so it needs its save). */
function hasInventorySockets(config: BuildConfig): boolean {
  return Object.values(config.slotsByWeapon).some((slots) => slots.some((socket) => socket?.gemId));
}

/** A saved build's editor: loads the build config plus its save (if any). */
function BuildRoute() {
  const { buildId } = Route.useParams();
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
    (async () => {
      try {
        const { config, saveId } = await getBuildForEdit(buildId);
        // Load the referenced save so the gems list / full stats are available.
        let inventory: Inventory | null = null;
        if (saveId) {
          inventory = await loadSaveInventory(saveId).catch(() => null);
        }
        if (active) setState({ status: 'ready', config, inventory, saveId: inventory ? saveId : null });
      } catch {
        if (active) setState({ status: 'notfound' });
      }
    })();
    return () => {
      active = false;
    };
  }, [buildId, user, authLoading]);

  if (state.status === 'ready') {
    return (
      <OptimizerApp
        key={buildId}
        inventory={state.inventory}
        initialBuild={state.config}
        activeSaveId={state.saveId}
        orphanedSave={state.inventory == null && hasInventorySockets(state.config)}
      />
    );
  }

  return (
    <div className="p-8">
      <Link to="/" className="text-sm text-au-chico underline transition-colors hover:text-pale-mocha">
        ← Bloodborne Optimizer
      </Link>
      <p className="mt-6 text-au-chico">
        {state.status === 'loading' && 'Loading build…'}
        {state.status === 'unauth' && 'Log in to view this build.'}
        {state.status === 'notfound' && 'Build not found.'}
      </p>
    </div>
  );
}
