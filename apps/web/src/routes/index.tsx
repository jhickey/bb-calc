import { createFileRoute } from '@tanstack/react-router';

import { OptimizerApp } from '#/components/OptimizerApp';

export const Route = createFileRoute('/')({ component: Home });

/** The default route: a free build with no save loaded. */
function Home() {
  return <OptimizerApp inventory={null} initialBuild={null} activeSaveId={null} />;
}
