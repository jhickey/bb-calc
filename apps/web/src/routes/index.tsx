import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';

import { OptimizerApp } from '#/components/OptimizerApp';
import { useAppDispatch } from '#/store';
import { buildActions } from '#/store/buildSlice';

export const Route = createFileRoute('/')({ component: Home });

/** The default route: a free build with no save loaded. */
function Home() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(buildActions.resetToFree());
  }, [dispatch]);
  return <OptimizerApp />;
}
