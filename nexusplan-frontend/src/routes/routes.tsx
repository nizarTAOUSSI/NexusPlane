import { createBrowserRouter } from 'react-router-dom';
import LandingPage from '../Pages/LandingPage';
import Page404 from '../Pages/Page404';
import LoginPage from '../Pages/LoginPage';
import SignupPage from '../Pages/SignupPage';

export const router = createBrowserRouter([
    {
        path: '/',
        element: <LandingPage />,
        errorElement: <Page404 />
    },
    {
        path: '*',
        element: <Page404 />
    },
    {
        path: '/login',
        element: <LoginPage />,
        errorElement: <Page404 />
    },
    {
        path: '/signup',
        element: <SignupPage />,
        errorElement: <Page404 />
    }
]);