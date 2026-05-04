import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar, { TopNavbar } from '../components/Sidebar';
import { RealtimeProvider } from '../context/RealtimeContext';
import CursorOverlay from '../components/CursorOverlay';

const DashboardLayout: React.FC = () => {
  return (
    <RealtimeProvider>
      <div className="app-shell">
        <TopNavbar />

        <div className="app-body">
          <Sidebar />
          <main className="app-main">
            <Outlet />
          </main>
        </div>

        <CursorOverlay />
      </div>
    </RealtimeProvider>
  );
};

export default DashboardLayout;
