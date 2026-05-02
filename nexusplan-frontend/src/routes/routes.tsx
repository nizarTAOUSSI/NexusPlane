import { createBrowserRouter } from 'react-router-dom';
import LandingPage   from '../Pages/LandingPage';
import Page404       from '../Pages/Page404';
import LoginPage     from '../Pages/LoginPage';
import SignupPage    from '../Pages/SignupPage';
import DashboardPage from '../Pages/DashboardPage';
import DashboardLayout from '../layouts/DashboardLayout';
import ProtectedRoute  from './ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
    errorElement: <Page404 />,
  },
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <Page404 />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
    errorElement: <Page404 />,
  },

  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: '/dashboard',              element: <DashboardPage /> },
          { path: '/dashboard/project',      element: <DashboardPage /> },
          { path: '/dashboard/revenue',      element: <DashboardPage /> },
          { path: '/dashboard/insights',     element: <DashboardPage /> },
          { path: '/dashboard/contracts',    element: <DashboardPage /> },
          { path: '/dashboard/payments',     element: <DashboardPage /> },
          { path: '/dashboard/notifications',element: <DashboardPage /> },
        ],
      },
    ],
  },

  { path: '*', element: <Page404 /> },
]);