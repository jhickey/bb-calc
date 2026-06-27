import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect } from 'react';

import { OptimizerApp } from '#/components/OptimizerApp';
import { useAuth } from '#/lib/auth';
import { useAppDispatch, useAppSelector } from '#/store';
import { loadSave } from '#/store/buildSlice';

export const Route = createFileRoute('/s/$saveId')({ component: SaveRoute });

/** A save's editor: loads the owner's inventory by id into the build slice. */
function SaveRoute() {
  const { saveId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.build.status);
  const activeSaveId = useAppSelector((s) => s.build.activeSaveId);

  useEffect(() => {
    if (authLoading || !user) return;
    void dispatch(loadSave(saveId));
  }, [dispatch, saveId, user, authLoading]);

  // Render the editor only once the slice reflects this save.
  if (user && status === 'ready' && activeSaveId === saveId) {
    return <OptimizerApp key={saveId} />;
  }

  return (
    <div className="p-8">
      <Link to="/" className="text-sm text-au-chico underline transition-colors hover:text-pale-mocha">
        ← Bloodborne Optimizer
      </Link>
      <p className="mt-6 text-au-chico">
        {authLoading && 'Loading…'}
        {!authLoading && !user && 'Log in to view this save.'}
        {!authLoading && user && status === 'notfound' && 'Save not found.'}
        {!authLoading && user && status !== 'notfound' && 'Loading save…'}
      </p>
    </div>
  );
}
