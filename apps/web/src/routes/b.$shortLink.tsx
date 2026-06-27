import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { SharedBuildView } from '#/components/SharedBuildView';
import type { SharedBuild } from '#/lib/builds';
import { getSharedBuild } from '#/lib/builds';

export const Route = createFileRoute('/b/$shortLink')({ component: SharedBuildPage });

type State =
  | { status: 'loading' }
  | { status: 'ready'; build: SharedBuild }
  | { status: 'notfound' }
  | { status: 'error'; error: string };

function SharedBuildPage() {
  const { shortLink } = Route.useParams();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    getSharedBuild(shortLink)
      .then((build) => {
        if (!active) return;
        setState(build ? { status: 'ready', build } : { status: 'notfound' });
      })
      .catch((e) => {
        if (active) setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      active = false;
    };
  }, [shortLink]);

  return (
    <div className="p-8">
      <a href="/" className="text-sm text-au-chico underline transition-colors hover:text-pale-mocha">
        ← Bloodborne Optimizer
      </a>
      <div className="mt-6">
        {state.status === 'loading' && <p className="text-au-chico">Loading build…</p>}
        {state.status === 'notfound' && <p className="text-au-chico">Build not found.</p>}
        {state.status === 'error' && <p className="text-red-400">Error: {state.error}</p>}
        {state.status === 'ready' && <SharedBuildView name={state.build.name} config={state.build.config} />}
      </div>
    </div>
  );
}
