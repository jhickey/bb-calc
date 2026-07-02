import { createRootRoute, HeadContent, Scripts } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { MotionConfig } from 'motion/react';
import { Provider } from 'react-redux';

import { AuthProvider } from '#/lib/auth';
import { store } from '#/store';
import appCss from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        name: 'description',
        content: 'Attack Rating calculator and gem optimizer for Bloodborne.',
      },
      {
        title: 'Bloodborne Optimizer',
      },
      { name: 'theme-color', content: '#1a0b06' },
      { property: 'og:title', content: 'Bloodborne Optimizer' },
      {
        property: 'og:description',
        content: 'Attack Rating calculator and gem optimizer for Bloodborne.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: 'Bloodborne Optimizer' },
      {
        name: 'twitter:description',
        content: 'Attack Rating calculator and gem optimizer for Bloodborne.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {/* reducedMotion="user" makes every animation honor prefers-reduced-motion. */}
        <Provider store={store}>
          <MotionConfig reducedMotion="user">
            <AuthProvider>{children}</AuthProvider>
          </MotionConfig>
        </Provider>
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        )}
        <Scripts />
      </body>
    </html>
  );
}
