import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect } from 'react';

import { OptimizerApp } from '#/components/OptimizerApp';
import { useAuth } from '#/lib/auth';
import { useAppDispatch, useAppSelector } from '#/store';
import { loadBuild } from '#/store/buildSlice';

export const Route = createFileRoute('/builds/$buildId')({ component: BuildRoute });

/** A saved build's editor: loads the build config plus its save into the slice. */
function BuildRoute() {
  const { buildId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.build.status);
  const activeBuildId = useAppSelector((s) => s.build.activeBuildId);

  useEffect(() => {
    if (authLoading || !user) return;
    void dispatch(loadBuild(buildId));
  }, [dispatch, buildId, user, authLoading]);

  if (user && status === 'ready' && activeBuildId === buildId) {
    return <OptimizerApp key={buildId} />;
  }

  return (
    <div className="p-8">
      <Link to="/" className="text-sm text-au-chico underline transition-colors hover:text-pale-mocha">
        ← Bloodborne Optimizer
      </Link>
      <p className="mt-6 text-au-chico">
        {authLoading && 'Loading…'}
        {!authLoading && !user && 'Log in to view this build.'}
        {!authLoading && user && status === 'notfound' && 'Build not found.'}
        {!authLoading && user && status !== 'notfound' && 'Loading build…'}
      </p>
    </div>
  );
}
