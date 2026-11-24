import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';

/** Renders routes with a fresh QueryClient and in-memory router, like the real app. */
export function renderRoutes(routes: RouteObject[], initialPath = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router };
}

export function renderAt(element: ReactElement, path = '/') {
  return renderRoutes([{ path, element }], path);
}
