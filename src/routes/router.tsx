import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';

import { AppLayout } from '@/components/layout/app-layout';
import { AuthLayout } from '@/components/layout/auth-layout';
import { SchermataCaricamento } from '@/components/layout/schermata-caricamento';
import { ErrorBoundaryRoute } from '@/routes/error-boundary-route';
import { ProtectedRoute } from '@/routes/protected-route';
import { PublicOnlyRoute } from '@/routes/public-only-route';
import { oggiISO } from '@/lib/format';

// Le pagine sono caricate on demand: il bundle iniziale resta piccolo,
// utile soprattutto su rete mobile.
const LoginPage = lazy(() => import('@/pages/login-page'));
const ResetPasswordPage = lazy(() => import('@/pages/reset-password-page'));
const DashboardPage = lazy(() => import('@/pages/dashboard-page'));
const DayPage = lazy(() => import('@/pages/day-page'));
const ReportsPage = lazy(() => import('@/pages/reports-page'));
const ProfilePage = lazy(() => import('@/pages/profile-page'));
const NotFoundPage = lazy(() => import('@/pages/not-found-page'));

function conSuspense(elemento: React.ReactNode): React.ReactNode {
  return <Suspense fallback={<SchermataCaricamento />}>{elemento}</Suspense>;
}

const routes: RouteObject[] = [
  {
    element: <PublicOnlyRoute />,
    errorElement: <ErrorBoundaryRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: conSuspense(<LoginPage />) },
          { path: '/reset-password', element: conSuspense(<ResetPasswordPage />) },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    errorElement: <ErrorBoundaryRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: conSuspense(<DashboardPage />) },
          { path: '/day/:date', element: conSuspense(<DayPage />) },
          // Scorciatoia: /day porta al giorno corrente.
          { path: '/day', element: <Navigate to={`/day/${oggiISO()}`} replace /> },
          { path: '/report', element: conSuspense(<ReportsPage />) },
          { path: '/profilo', element: conSuspense(<ProfilePage />) },
          { path: '*', element: conSuspense(<NotFoundPage />) },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
