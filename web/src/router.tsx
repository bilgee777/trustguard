import { createBrowserRouter } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { AnalyzerPage } from '@/pages/AnalyzerPage';
import { DemoPage } from '@/pages/DemoPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PrivacyPage } from '@/pages/PrivacyPage';
import { ResultPage } from '@/pages/ResultPage';
import { RouteError } from '@/pages/RouteError';
import { UrlInspectorPage } from '@/pages/UrlInspectorPage';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <AnalyzerPage /> },
      { path: 'analysis/:id', element: <ResultPage /> },
      { path: 'url-inspector', element: <UrlInspectorPage /> },
      { path: 'demo', element: <DemoPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
