import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // Rendered in place of matched routes while they resolve. In SPA mode this
    // is what gets baked into the prerendered shell, so it doubles as the
    // initial loading state shown before hydration picks up the real route.
    defaultPendingComponent: () => <div className="p-8 text-lg text-gray-500">Loading…</div>,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
