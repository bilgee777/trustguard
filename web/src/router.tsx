import { createBrowserRouter } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { AnalyzerPage } from '@/pages/AnalyzerPage';
import { DemoPage } from '@/pages/DemoPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PrivacyPage } from '@/pages/PrivacyPage';
import { ResultPage } from '@/pages/ResultPage';
import { RouteError } from '@/pages/RouteError';
import { UrlInspectorPage } from '@/pages/UrlInspectorPage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { HistoryDetailPage } from '@/pages/HistoryDetailPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { SessionEndedPage } from '@/pages/SessionEndedPage';
import { SettingsPage } from '@/pages/SettingsPage';

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
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'session-ended', element: <SessionEndedPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'history', element: <HistoryPage /> },
          { path: 'history/:id', element: <HistoryDetailPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
