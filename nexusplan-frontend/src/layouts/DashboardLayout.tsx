import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar, { TopNavbar } from '../components/Sidebar';

const DashboardLayout: React.FC = () => {
  return (
    <div className="app-shell">
      <TopNavbar />

      <div className="app-body">
        <Sidebar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
